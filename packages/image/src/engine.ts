import { createObjectStore } from '@rss/core';
import type { AspectRatio, ImageJobType, StyleSpec } from '@rss/core';
import type { ImageModelAdapter } from './types.js';
import { createImageAdapter } from './adapters/factory.js';
import { modelForJob } from './router.js';
import { assembleImagePrompt } from './promptAssembly.js';
import { loadBrandStyleGrounding } from './grounding.js';

export interface ImageRef {
  slideIndex: number;
  storageKey: string;
  modelUsed: string;
  aspectRatio: AspectRatio;
}

export interface GenerateSingleArgs {
  postId: string;
  slideIndex?: number;
  jobType: ImageJobType;
  concept: string;
  aspectRatio: AspectRatio;
  headlineText?: string;
  subText?: string;
  seed?: number;
  styleSpec?: StyleSpec;
  styleNote?: string;
  slideContext?: string;
  referenceStyle?: string;
  /** Override the computed storage key. Used by the hybrid flow to park an editorial BACKGROUND at its own
   * key (e.g. posts/<id>/_bg/<i>.png) so it never collides with the final composited slide. */
  storageKey?: string;
}

export interface AssembleCarouselArgs {
  postId: string;
  aspectRatio: AspectRatio;
  styleSpec: StyleSpec;
  seed: number;
  slides: { concept: string; headlineText?: string; subText?: string; jobType?: ImageJobType }[];
}

/**
 * The image engine: route by job type → assemble a brand-aware prompt → render via the adapter →
 * store to the object store → return a reference. Carousels pin ONE style spec + ONE seed + a
 * uniform aspect ratio across every slide (02 §4) — the consistency control.
 */
export class ImageEngine {
  constructor(
    private readonly adapter: ImageModelAdapter = createImageAdapter(),
    private readonly store = createObjectStore(),
    // Upgrade C: the cached vision-grounded brand-style description, injected into every prompt (if present).
    private readonly brandStyle: string | undefined = loadBrandStyleGrounding(),
  ) {}

  async generateSingle(args: GenerateSingleArgs): Promise<ImageRef> {
    const slideIndex = args.slideIndex ?? 0;
    const prompt = assembleImagePrompt({
      jobType: args.jobType,
      concept: args.concept,
      aspectRatio: args.aspectRatio,
      headlineText: args.headlineText,
      subText: args.subText,
      styleNote: args.styleNote,
      slideContext: args.slideContext,
      referenceStyle: args.referenceStyle ?? this.brandStyle,
    });
    const model = modelForJob(args.jobType);
    const result = await this.adapter.generate({
      prompt,
      aspectRatio: args.aspectRatio,
      model,
      jobType: args.jobType,
      seed: args.seed,
      styleSpec: args.styleSpec,
    });
    const ext = result.mediaType.includes('png')
      ? 'png'
      : result.mediaType.includes('webp')
        ? 'webp'
        : 'jpg';
    const storageKey = args.storageKey ?? `posts/${args.postId}/${slideIndex}.${ext}`;
    await this.store.put(storageKey, result.bytes, result.mediaType);
    return { slideIndex, storageKey, modelUsed: result.modelUsed, aspectRatio: args.aspectRatio };
  }

  async assembleCarousel(args: AssembleCarouselArgs, onProgress?: (message: string) => void): Promise<ImageRef[]> {
    if (args.slides.length < 2) throw new Error('A carousel needs at least 2 slides.');
    const styleNote = summarizeStyleSpec(args.styleSpec);
    const refs: ImageRef[] = [];
    for (let i = 0; i < args.slides.length; i++) {
      const slide = args.slides[i]!;
      refs.push(
        await this.generateSingle({
          postId: args.postId,
          slideIndex: i,
          jobType: slide.jobType ?? 'carousel_slide',
          concept: slide.concept,
          headlineText: slide.headlineText,
          subText: slide.subText,
          aspectRatio: args.aspectRatio, // uniform across the set
          seed: args.seed, // one pinned seed across the set
          styleSpec: args.styleSpec,
          styleNote,
          slideContext: `Slide ${i + 1} of ${args.slides.length} in one cohesive set.`,
        }),
      );
      onProgress?.(`rendered slide ${i + 1}/${args.slides.length}`);
    }
    return refs;
  }
}

/**
 * The locked style, in PROSE for the prompt. Critically: strip hex codes and the literal font name — the
 * palette is metadata, not copy. recraft will typeset stray "#0a0a0a"/"Raleway" tokens into the slide
 * otherwise (observed in the first carousel probe). The exact palette stays on the StyleSpec for the record.
 */
function summarizeStyleSpec(s: StyleSpec): string {
  const sanitize = (v: string): string =>
    v
      .replace(/#[0-9a-fA-F]{3,8}/g, '')
      .replace(/raleway/gi, 'a clean modern geometric sans')
      .replace(/\s{2,}/g, ' ')
      .trim();
  return [s.illustration_style, s.layout_grammar, s.type_treatment].map(sanitize).filter(Boolean).join('; ');
}
