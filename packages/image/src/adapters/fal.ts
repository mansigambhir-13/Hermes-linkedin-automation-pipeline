import { fal } from '@fal-ai/client';
import type { AspectRatio } from '@rss/core';
import type { GenerateRequest, GenerateResult, ImageModelAdapter } from '../types.js';
import { withTimeout } from './hardened.js';

/** Per-attempt timeout so a hung fal call fails fast and the retry loop below can try again. */
const ATTEMPT_TIMEOUT_MS = Number(process.env.FAL_ATTEMPT_TIMEOUT_MS ?? 60_000);

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const key = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (!key) throw new Error('fal not configured: set FAL_API_KEY (Directive 02).');
  fal.config({ credentials: key });
  configured = true;
}

// imagen4 / ideogram take `aspect_ratio`; recraft takes an `image_size` enum. Map our ratios to each.
const ASPECT_RATIO: Record<AspectRatio, string> = { '1:1': '1:1', '4:5': '3:4', '9:16': '9:16', '1.91:1': '16:9' };
const IMAGE_SIZE: Record<AspectRatio, string> = {
  '1:1': 'square_hd',
  '4:5': 'portrait_4_3',
  '9:16': 'portrait_16_9',
  '1.91:1': 'landscape_16_9',
};

interface FalImageOutput {
  images?: { url: string; content_type?: string }[];
}

/**
 * Renders via fal.ai (Directive 02). `fal.subscribe` auto-polls fal's queue. Requires FAL_API_KEY.
 * Recraft (`fal-ai/recraft-v3`) uses `image_size` and has NO seed param — carousel consistency relies on
 * the locked style-spec prompt (the gate measures whether that holds). imagen4/ideogram use `aspect_ratio`
 * and honor `seed`.
 */
export class FalImageAdapter implements ImageModelAdapter {
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    ensureConfigured();
    const isRecraft = req.model.includes('recraft');
    const input: Record<string, unknown> = { prompt: req.prompt };
    if (isRecraft) {
      input.image_size = IMAGE_SIZE[req.aspectRatio];
      // Force conceptual illustration — recraft defaults to photoreal stock otherwise (first carousel probe).
      input.style = 'digital_illustration';
      // recraft-v3 rejects prompts > 1000 chars (422); cap defensively (brand block is already compact).
      if (req.prompt.length > 1000) input.prompt = req.prompt.slice(0, 1000);
    } else {
      input.aspect_ratio = ASPECT_RATIO[req.aspectRatio];
      if (req.seed !== undefined) input.seed = req.seed;
    }

    // Retry transient failures (queue hiccups, 5xx, network) — image gen occasionally blips.
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await withTimeout(fal.subscribe(req.model, { input }), ATTEMPT_TIMEOUT_MS, `fal ${req.model}`);
        const data = result.data as FalImageOutput;
        const image = data.images?.[0];
        if (!image?.url) throw new Error(`fal ${req.model}: no image url in response`);

        const resp = await withTimeout(fetch(image.url), ATTEMPT_TIMEOUT_MS, 'fal image download');
        if (!resp.ok) throw new Error(`fal: image download failed (${resp.status})`);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        if (bytes.length === 0) throw new Error(`fal ${req.model}: downloaded image was empty`);
        return { bytes, mediaType: image.content_type ?? 'image/png', modelUsed: req.model };
      } catch (e) {
        last = e;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    throw new Error(`fal ${req.model} failed after 3 attempts: ${last instanceof Error ? last.message : String(last)}`);
  }
}
