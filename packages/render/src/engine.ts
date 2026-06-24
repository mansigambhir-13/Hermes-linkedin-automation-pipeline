import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { createObjectStore } from '@rss/core';
import type { AspectRatio } from '@rss/core';
import { CANVAS } from './tokens.js';
import {
  statementCard,
  glossaryCard,
  hybridCard,
  jargonCard,
  type StatementData,
  type GlossaryData,
  type HybridData,
  type JargonData,
} from './templates.js';

/** Mirrors @rss/image ImageRef so the deterministic path is symmetric with the AI path downstream. */
export interface RenderRef {
  slideIndex: number;
  storageKey: string;
  modelUsed: string; // 'html-chromium' — keeps the field shape identical to the AI engine
  aspectRatio: AspectRatio;
}

export type CardTemplate = 'statement' | 'glossary' | 'hybrid' | 'jargon';
export type CardData = StatementData | GlossaryData | HybridData | JargonData;

export interface RenderCardArgs {
  postId: string;
  slideIndex?: number;
  template: CardTemplate;
  aspectRatio: AspectRatio;
  data: CardData;
}

export interface RenderCarouselArgs {
  postId: string;
  template: CardTemplate;
  aspectRatio: AspectRatio; // uniform across the set — the consistency control
  slides: CardData[];
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

/**
 * Make an image URL loadable from a setContent page. Chromium blocks file:// subresources on a
 * setContent page (no file origin), so a local file is read and inlined as a data URI. http(s) and data:
 * URLs (e.g. an S3/Supabase presigned URL in prod) pass through untouched for Chromium to fetch.
 */
export async function toEmbeddable(url: string): Promise<string> {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const path = url.startsWith('file://') ? fileURLToPath(url) : url;
  const ext = path.split('.').pop()?.toLowerCase() ?? 'png';
  const bytes = await readFile(path);
  return `data:${MIME[ext] ?? 'image/png'};base64,${bytes.toString('base64')}`;
}

/**
 * Inline any local (file://) image field so Chromium can load it from a setContent page. Covers every
 * template that carries an image: hybrid backgroundUrl, glossary/jargon bannerUrl. http(s)/data: pass through.
 */
async function resolveImages(template: CardTemplate, data: CardData): Promise<CardData> {
  switch (template) {
    case 'hybrid': {
      const d = data as HybridData;
      return { ...d, backgroundUrl: await toEmbeddable(d.backgroundUrl) };
    }
    case 'glossary': {
      const d = data as GlossaryData;
      return d.bannerUrl ? { ...d, bannerUrl: await toEmbeddable(d.bannerUrl) } : d;
    }
    case 'jargon': {
      const d = data as JargonData;
      return d.bannerUrl ? { ...d, bannerUrl: await toEmbeddable(d.bannerUrl) } : d;
    }
    default:
      return data;
  }
}

function htmlFor(template: CardTemplate, data: CardData, ar: AspectRatio): string {
  switch (template) {
    case 'glossary':
      return glossaryCard(data as GlossaryData, ar);
    case 'hybrid':
      return hybridCard(data as HybridData, ar);
    case 'jargon':
      return jargonCard(data as JargonData, ar);
    default:
      return statementCard(data as StatementData, ar);
  }
}

/**
 * Deterministic brand renderer: HTML/CSS brand templates → headless Chromium screenshot → PNG → object store.
 * The pixel-exact, never-hallucinated counterpart to @rss/image's AI ImageEngine. One shared browser is
 * launched lazily and reused across slides (a carousel renders in one browser, many pages).
 */
export interface RenderEngineOptions {
  /** Max pages rendering at once — a backpressure guard so a burst can't OOM Chromium. */
  maxConcurrency?: number;
  /** Per-render hard timeout (ms) — a hung remote banner image can never block the worker forever. */
  timeoutMs?: number;
}

export class RenderEngine {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private readonly maxConcurrency: number;
  private readonly timeoutMs: number;
  private active = 0;
  private readonly waiters: (() => void)[] = [];

  constructor(
    private readonly store = createObjectStore(),
    opts: RenderEngineOptions = {},
  ) {
    this.maxConcurrency = opts.maxConcurrency ?? Number(process.env.RENDER_CONCURRENCY ?? 4);
    this.timeoutMs = opts.timeoutMs ?? Number(process.env.RENDER_TIMEOUT_MS ?? 30_000);
  }

  /** Lazily launch one shared browser; relaunch transparently if a prior crash left it disconnected. */
  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    this.browser = null;
    // Collapse concurrent first-callers onto a single launch.
    if (!this.launching) {
      this.launching = chromium
        .launch({ args: ['--no-sandbox', '--disable-gpu'] })
        .then((b) => {
          this.browser = b;
          this.launching = null;
          return b;
        })
        .catch((e) => {
          this.launching = null;
          throw e;
        });
    }
    return this.launching;
  }

  /** Tiny semaphore: block until a render slot frees up, then proceed. */
  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
  }

  private release(): void {
    this.active--;
    this.waiters.shift()?.();
  }

  /** Render one card and store it. Returns a RenderRef (symmetric with ImageRef). */
  async renderCard(args: RenderCardArgs): Promise<RenderRef> {
    const slideIndex = args.slideIndex ?? 0;
    const { width, height } = CANVAS[args.aspectRatio];
    // Inline any local (file://) image so Chromium can load it from the setContent page (see resolveImages).
    const data = await resolveImages(args.template, args.data);
    const html = htmlFor(args.template, data, args.aspectRatio);
    const bytes = await this.screenshot(html, width, height);
    const storageKey = `posts/${args.postId}/${slideIndex}.png`;
    await this.store.put(storageKey, bytes, 'image/png');
    return { slideIndex, storageKey, modelUsed: 'html-chromium', aspectRatio: args.aspectRatio };
  }

  /** Render an ordered, consistent carousel — same template + uniform aspect ratio across every slide. */
  async renderCarousel(args: RenderCarouselArgs, onProgress?: (m: string) => void): Promise<RenderRef[]> {
    if (args.slides.length < 2) throw new Error('A carousel needs at least 2 slides.');
    const refs: RenderRef[] = [];
    for (let i = 0; i < args.slides.length; i++) {
      refs.push(
        await this.renderCard({
          postId: args.postId,
          slideIndex: i,
          template: args.template,
          aspectRatio: args.aspectRatio,
          data: args.slides[i]!,
        }),
      );
      onProgress?.(`rendered slide ${i + 1}/${args.slides.length}`);
    }
    return refs;
  }

  /** Core: set content, wait for fonts, screenshot at an exact viewport. Concurrency-gated; one crash-retry. */
  private async screenshot(html: string, width: number, height: number): Promise<Buffer> {
    await this.acquire();
    try {
      try {
        return await this.renderOnce(html, width, height);
      } catch (e) {
        // If the shared browser crashed/disconnected, drop it and try once more on a fresh launch.
        if (!this.browser?.isConnected()) {
          this.browser = null;
          return await this.renderOnce(html, width, height);
        }
        throw e;
      }
    } finally {
      this.release();
    }
  }

  private async renderOnce(html: string, width: number, height: number): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(this.timeoutMs);
    try {
      // Fonts are inlined (no network) but a glossary banner may be a remote URL — 'networkidle' covers it,
      // bounded by the per-page timeout so a hung image can never block forever.
      await page.setContent(html, { waitUntil: 'networkidle', timeout: this.timeoutMs });
      // Belt-and-braces: ensure webfonts are actually parsed before the snapshot (prevents fallback-font flicker).
      // Reach `document` via globalThis so this package needs no DOM lib in its tsconfig (runs in the page, not Node).
      await page.evaluate(() => {
        const g = globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } };
        return g.document.fonts.ready;
      });
      return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    } finally {
      await page.close();
    }
  }

  /** Release the shared browser. Call once when a batch of renders is done (or on worker shutdown). */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
