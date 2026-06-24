import { ImageEngine } from '@rss/image';
import { RenderEngine } from '@rss/render';
import { loadLockedConfig, composeCaption } from '@rss/core';
import type { AspectRatio, PostFormat, PublishPlatform, StyleSpec } from '@rss/core';
import { draftCaption, draftSlides } from './draft.js';
import { makeHybridDeps, renderHybridCard, renderHybridCarousel, type HybridDeps } from './hybrid.js';

/**
 * The end-to-end compose pipeline (transport-agnostic): idea → caption (Anthropic) → visuals.
 * This is the unit a surface drives — the Slack bot today, and what Hermes orchestrates via the MCP tools.
 * It generates + stores only; it NEVER publishes (publishing is a separate, approval-gated step).
 *
 * Visuals run in one of three modes (see VisualMode). The DEFAULT is `render` — deterministic, on-brand,
 * pixel-exact typeset cards via headless Chromium that need NO fal key and no per-image cost. This is what
 * makes prod have real images (legacy AI `/draft` generation is disabled in prod). `ai`/`hybrid` are opt-in.
 */

/**
 * render — deterministic typeset cards (Chromium). Default; no fal key, on-brand, free, fast.
 * ai     — wordless AI concept images (fal). The legacy path; needs FAL_API_KEY.
 * hybrid — AI editorial background + deterministic typeset frame composited. Needs FAL_API_KEY.
 */
export type VisualMode = 'render' | 'ai' | 'hybrid';

function resolveVisualMode(input?: VisualMode): VisualMode {
  const v = input ?? (process.env.VISUAL_MODE as VisualMode | undefined) ?? 'render';
  return v === 'ai' || v === 'hybrid' ? v : 'render';
}

const ARTIFACTS = process.env.LOCAL_ARTIFACTS_DIR || '.artifacts';

/** The single locked carousel style spec — same world across every slide (the consistency control). */
const REHEARSAL_STYLE: StyleSpec = {
  palette: ['#0a0a0a', '#9677f8', '#4e44fd', '#ff4859', '#00c483', '#f5f5f5'],
  type_treatment: 'Raleway sans; large confident headline; generous negative space',
  layout_grammar: 'one focal idea per slide; dark near-black canvas; signature gradient on a single element',
  illustration_style: 'conceptual editorial illustration; modern, a little cinematic; never literal stock',
};

function ratioFor(platform: PublishPlatform, format: PostFormat): AspectRatio {
  if (format === 'carousel') return '1:1';
  return platform === 'instagram' ? '4:5' : '1.91:1';
}

/** Append the locked CTA + hashtags (never written by the model). Falls back to the raw body if config is absent. */
function composeFinal(platform: PublishPlatform, body: string): { caption: string; ctaApplied: boolean } {
  try {
    return { caption: composeCaption(platform, body, loadLockedConfig()), ctaApplied: true };
  } catch {
    return { caption: body, ctaApplied: false }; // locked-config.json not present yet — still PROVISIONAL
  }
}

export interface ComposeInput {
  idea: string;
  platform: PublishPlatform; // one platform per draft (no 'both')
  format: PostFormat;
  createdBy: string;
  slideCount?: number;
  instruction?: string; // refine instruction carried from a Slack "Refine" action
  visualMode?: VisualMode; // default 'render' (deterministic) — see VisualMode / VISUAL_MODE env
}

export interface ComposedImage {
  slideIndex: number;
  storageKey: string;
  localPath: string;
  modelUsed: string;
  headline?: string;
  altText?: string; // accessibility text (carousel: slide headline; single: the visual concept)
}

export interface ComposedDraft {
  postId: string;
  idea: string;
  platform: PublishPlatform;
  format: PostFormat;
  hook: string;
  captionBody: string;
  caption: string; // body + locked CTA/hashtags (provisional until locked-config.json lands)
  ctaApplied: boolean;
  visualConcept: string;
  rationale: string;
  banned: string[];
  aspectRatio: AspectRatio;
  images: ComposedImage[];
  /** X multi-tweet thread (sanitized, in order) — present only for thread posts; publishing uses this. */
  thread?: string[];
  /** True if the post cannot ship without an image (IG always; image-essential cards). */
  mediaRequired?: boolean;
}

export interface ComposeOptions {
  model?: string;
  /** Progress callback for slow steps (caption ready, rendering, per-slide) — surfaces in the Slack thinking message. */
  onProgress?: (message: string) => void;
}

export async function composeDraft(input: ComposeInput, opts: ComposeOptions = {}): Promise<ComposedDraft> {
  // Captions run on Anthropic (gpt-oss/Bedrock retired). Model id from ANTHROPIC_MODEL, sensible default.
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const progress = opts.onProgress ?? (() => {});

  const caption = await draftCaption(
    { idea: input.idea, platform: input.platform, format: input.format, instruction: input.instruction },
    model,
  );
  progress('✍️ Caption ready — preparing the visual…');
  const { caption: finalCaption, ctaApplied } = composeFinal(input.platform, caption.caption_body);

  const visualMode = resolveVisualMode(input.visualMode);
  const postId = `slack-${Date.now().toString(36)}`;
  const aspectRatio = ratioFor(input.platform, input.format);
  const images: ComposedImage[] = [];

  // Map a stored image ref → the surface-facing ComposedImage (localPath is where LocalObjectStore wrote it).
  const toImage = (r: { slideIndex: number; storageKey: string; modelUsed: string }, headline?: string, altText?: string): ComposedImage => ({
    slideIndex: r.slideIndex,
    storageKey: r.storageKey,
    localPath: `${ARTIFACTS}/${r.storageKey}`,
    modelUsed: r.modelUsed,
    headline,
    altText: altText ?? headline,
  });

  // Engines are created per-mode and closed in finally (the deterministic engine owns a Chromium process).
  let renderEngine: RenderEngine | undefined;
  let hybridDeps: HybridDeps | undefined;
  try {
    if (input.format === 'carousel') {
      const n = input.slideCount ?? 4;
      const slides = await draftSlides(
        { idea: input.idea, hook: caption.hook, body: caption.caption_body, visualConcept: caption.visual_concept, platform: input.platform, n },
        model,
      );
      progress(`🖼️ ${slides.length} slide concepts ready — rendering (${visualMode})…`);
      if (visualMode === 'ai') {
        const refs = await new ImageEngine().assembleCarousel(
          { postId, aspectRatio, styleSpec: REHEARSAL_STYLE, seed: 7, slides: slides.map((s) => ({ concept: s.concept, jobType: 'hero' as const })) },
          (m) => progress(`🖼️ ${m}`),
        );
        refs.forEach((r, i) => images.push(toImage(r, slides[i]?.headline, slides[i]?.headline ?? slides[i]?.concept)));
      } else if (visualMode === 'hybrid') {
        hybridDeps = makeHybridDeps();
        const refs = await renderHybridCarousel(
          hybridDeps,
          { postId, aspectRatio, styleSpec: REHEARSAL_STYLE, seed: 7, slides: slides.map((s) => ({ concept: s.concept, headline: s.headline })) },
          (m) => progress(`🖼️ ${m}`),
        );
        refs.forEach((r, i) => images.push(toImage(r, slides[i]?.headline)));
      } else {
        renderEngine = new RenderEngine();
        const refs = await renderEngine.renderCarousel(
          { postId, template: 'statement', aspectRatio, slides: slides.map((s, i) => ({ headline: s.headline, eyebrow: `${i + 1} / ${n}`, footer: i === slides.length - 1 })) },
          (m) => progress(`🖼️ ${m}`),
        );
        refs.forEach((r, i) => images.push(toImage(r, slides[i]?.headline)));
      }
    } else {
      progress(`🖼️ Rendering the image (${visualMode})…`);
      if (visualMode === 'ai') {
        const ref = await new ImageEngine().generateSingle({ postId, jobType: 'hero', concept: caption.visual_concept, aspectRatio });
        images.push(toImage(ref, undefined, caption.visual_concept));
      } else if (visualMode === 'hybrid') {
        hybridDeps = makeHybridDeps();
        const ref = await renderHybridCard(hybridDeps, { postId, aspectRatio, slides: [{ concept: caption.visual_concept, headline: caption.hook }] });
        images.push(toImage(ref, caption.hook));
      } else {
        renderEngine = new RenderEngine();
        const ref = await renderEngine.renderCard({ postId, template: 'statement', aspectRatio, data: { headline: caption.hook } });
        images.push(toImage(ref, caption.hook));
      }
    }
  } finally {
    if (renderEngine) await renderEngine.close();
    if (hybridDeps) await hybridDeps.render.close();
  }

  return {
    postId,
    idea: input.idea,
    platform: input.platform,
    format: input.format,
    hook: caption.hook,
    captionBody: caption.caption_body,
    caption: finalCaption,
    ctaApplied,
    visualConcept: caption.visual_concept,
    rationale: caption.rationale,
    banned: caption.banned,
    aspectRatio,
    images,
  };
}
