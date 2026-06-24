import type { PublishPlatform } from '@rss/core';

export type PublishFormat = 'single' | 'document' | 'carousel';

export interface PublishRequest {
  postId: string;
  platform: PublishPlatform;
  format: PublishFormat;
  caption: string; // already composed (body + locked CTA + hashtags)
  mediaUrls: string[]; // fresh public URLs, minted at publish time
  aspectRatios: string[];
  altTexts?: string[]; // per-image accessibility text (LinkedIn supports it; IG Graph API doesn't expose it)
  thread?: string[]; // X only: full multi-tweet thread (the adapter posts each as a value[] entry)
}

export interface PublishResult {
  externalId: string;
}

/** Pluggable per-platform transport — stub in dev, real (gated) adapters at go-live. */
export interface PublisherAdapter {
  publish(req: PublishRequest): Promise<PublishResult>;
}

export class ApprovalRequiredError extends Error {
  constructor(message = 'Publish refused: requires an explicit human approval (approved_by) + post_id.') {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

export class PublishPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishPreconditionError';
  }
}
