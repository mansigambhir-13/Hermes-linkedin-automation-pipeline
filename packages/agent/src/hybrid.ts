import { createObjectStore, type AspectRatio, type StyleSpec, type ObjectStore } from '@rss/core';
import { ImageEngine } from '@rss/image';
import { RenderEngine, type RenderRef } from '@rss/render';

/**
 * Hybrid composition orchestrator (the composition root for AI background + deterministic overlay).
 * Per slide: (1) the ImageEngine renders a WORDLESS editorial background and parks it at a private _bg key;
 * (2) we mint its URL; (3) the RenderEngine composites the exact brand frame + typeset headline on top and
 * stores the FINAL slide at the normal post key. The AI never typesets text — the brand furniture is exact.
 *
 * Lives in @rss/agent (not @rss/render) so the deterministic renderer stays decoupled from the AI engine;
 * the agent layer is where AI + render are composed. Used by the compose pipeline and the MCP tool-server.
 */
export interface HybridSlide {
  /** The rich editorial scene for the AI background (no text in it). */
  concept: string;
  /** The headline typeset deterministically on top. */
  headline: string;
  sub?: string;
  eyebrow?: string;
  footer?: boolean;
  scrim?: number;
}

export interface HybridArgs {
  postId: string;
  aspectRatio: AspectRatio;
  slides: HybridSlide[];
  styleSpec?: StyleSpec;
  seed?: number;
}

export interface HybridDeps {
  image: ImageEngine;
  render: RenderEngine;
  store: ObjectStore;
}

export function makeHybridDeps(): HybridDeps {
  return { image: new ImageEngine(), render: new RenderEngine(), store: createObjectStore() };
}

/** Steer the AI toward a background that text can sit on: dark, low-clutter, with central negative space. */
const BG_SUITABILITY =
  ' Composed as a BACKGROUND for overlaid text: dark and low-contrast overall, minimal clutter, the focal ' +
  'element kept to the edges with generous empty negative space through the centre. No text.';

async function renderOne(deps: HybridDeps, args: HybridArgs, i: number, total: number): Promise<RenderRef> {
  const slide = args.slides[i]!;
  const bgKey = `posts/${args.postId}/_bg/${i}.png`;
  // 1. AI editorial background — no headlineText ⇒ editorial mode (pure imagery, no typeset text).
  await deps.image.generateSingle({
    postId: args.postId,
    slideIndex: i,
    jobType: 'carousel_slide',
    concept: slide.concept + BG_SUITABILITY,
    aspectRatio: args.aspectRatio,
    seed: args.seed,
    styleSpec: args.styleSpec,
    storageKey: bgKey,
    slideContext: total > 1 ? `Slide ${i + 1} of ${total} in one cohesive set.` : undefined,
  });
  // 2. Mint a URL the renderer (Chromium) can load (file:// in dev, https in prod).
  const backgroundUrl = await deps.store.url(bgKey);
  // 3. Composite the exact brand frame + typeset headline over it ⇒ final slide at the normal key.
  return deps.render.renderCard({
    postId: args.postId,
    slideIndex: i,
    template: 'hybrid',
    aspectRatio: args.aspectRatio,
    data: {
      backgroundUrl,
      headline: slide.headline,
      sub: slide.sub,
      eyebrow: slide.eyebrow,
      footer: slide.footer,
      scrim: slide.scrim,
    },
  });
}

/** Render a single hybrid slide. */
export async function renderHybridCard(deps: HybridDeps, args: HybridArgs): Promise<RenderRef> {
  return renderOne(deps, args, 0, 1);
}

/** Render an ordered hybrid carousel — uniform aspect ratio + (optionally) one locked style spec/seed. */
export async function renderHybridCarousel(
  deps: HybridDeps,
  args: HybridArgs,
  onProgress?: (m: string) => void,
): Promise<RenderRef[]> {
  if (args.slides.length < 2) throw new Error('A carousel needs at least 2 slides.');
  const refs: RenderRef[] = [];
  for (let i = 0; i < args.slides.length; i++) {
    refs.push(await renderOne(deps, args, i, args.slides.length));
    onProgress?.(`composited slide ${i + 1}/${args.slides.length}`);
  }
  return refs;
}
