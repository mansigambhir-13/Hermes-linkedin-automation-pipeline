import type { AspectRatio, ImageJobType, StyleSpec } from '@rss/core';

/** A single render request after routing (model resolved, prompt assembled). */
export interface GenerateRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  model: string; // gateway 'provider/model' id, resolved from config/image_routing.json
  jobType: ImageJobType;
  seed?: number;
  styleSpec?: StyleSpec;
}

export interface GenerateResult {
  bytes: Uint8Array;
  mediaType: string;
  modelUsed: string;
}

/** Pluggable per-vendor transport (02 §6) — gateway in prod, stub in dev. */
export interface ImageModelAdapter {
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
