import type { PostStatus, PublishPlatform } from '@rss/core';
import { ApprovalRequiredError } from './types.js';
import type { PublisherAdapter, PublishFormat } from './types.js';

export interface ResolvedPost {
  caption: string; // composed final caption (body + locked CTA + hashtags)
  mediaKeys: string[];
  aspectRatios: string[];
  altTexts?: string[]; // per-image accessibility text
  thread?: string[]; // X multi-tweet thread (each tweet); when present the X adapter posts a thread
}

/** Injected dependencies — real (Supabase/S3/adapter) in prod, fakes in tests. */
export interface PublishDeps {
  resolvePost(postId: string): Promise<ResolvedPost | null>;
  mintUrl(key: string): Promise<string>;
  findSuccessfulPublish(postId: string, platform: PublishPlatform): Promise<string | null>;
  recordPublish(entry: {
    postId: string;
    platform: PublishPlatform;
    externalId: string | null;
    status: 'success' | 'failed';
    error?: string;
  }): Promise<void>;
  setStatus(postId: string, status: PostStatus): Promise<void>;
  adapter: PublisherAdapter;
  onFailure?(message: string): void;
}

export interface PublishArgs {
  postId: string;
  platform: PublishPlatform;
  format: PublishFormat;
  approvedBy?: string;
}

export interface PublishOutcome {
  externalId: string;
  skipped: boolean;
}

/**
 * The publish state machine (06 §B5). Non-negotiables enforced HERE, structurally:
 *  - Approval gate: refuses without an explicit human approval, before any side effect.
 *  - Idempotency: checks publish_log for a prior success before any external call.
 *  - Status: in_review → publishing → published | failed; failures surfaced via onFailure.
 */
export async function publishPost(args: PublishArgs, deps: PublishDeps): Promise<PublishOutcome> {
  if (!args.approvedBy || args.approvedBy.trim() === '') {
    throw new ApprovalRequiredError();
  }

  const existing = await deps.findSuccessfulPublish(args.postId, args.platform);
  if (existing) return { externalId: existing, skipped: true };

  const post = await deps.resolvePost(args.postId);
  if (!post) throw new Error(`Publish: post ${args.postId} not found.`);

  await deps.setStatus(args.postId, 'publishing');
  try {
    const mediaUrls = await Promise.all(post.mediaKeys.map((k) => deps.mintUrl(k)));
    const { externalId } = await deps.adapter.publish({
      postId: args.postId,
      platform: args.platform,
      format: args.format,
      caption: post.caption,
      mediaUrls,
      aspectRatios: post.aspectRatios,
      altTexts: post.altTexts,
      thread: post.thread,
    });
    await deps.recordPublish({ postId: args.postId, platform: args.platform, externalId, status: 'success' });
    await deps.setStatus(args.postId, 'published');
    return { externalId, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.recordPublish({ postId: args.postId, platform: args.platform, externalId: null, status: 'failed', error: message });
    await deps.setStatus(args.postId, 'failed');
    deps.onFailure?.(`Publish failed for ${args.postId} on ${args.platform}: ${message}`);
    throw err;
  }
}
