import {
  getPost as coreGetPost,
  findSuccessfulPublish,
  insertPublishLog,
  updatePostStatus,
  composeCaption,
  loadLockedConfig,
  createObjectStore,
} from '@rss/core';
import type { PublishPlatform, PostStatus } from '@rss/core';
import type { PublishDeps, ResolvedPost } from './publisher.js';
import { createPublisher } from './adapters/factory.js';

/**
 * Production wiring: binds the orchestrator to Supabase (system of record) + S3 + the platform adapter.
 * resolvePost composes the final caption here (body + locked CTA/hashtags) — re-validating locked config
 * at publish time. Requires DATABASE_URL + a real locked-config; the adapter is go-live gated.
 */
export function makePublishDeps(platform: PublishPlatform): PublishDeps {
  const store = createObjectStore();
  return {
    async resolvePost(postId: string): Promise<ResolvedPost | null> {
      const pw = await coreGetPost(postId);
      if (!pw) return null;
      const bodyField = platform === 'linkedin' ? pw.post.caption_body_linkedin : pw.post.caption_body_instagram;
      const body = typeof bodyField === 'string' ? bodyField : '';
      const caption = composeCaption(platform, body, loadLockedConfig());
      const mediaKeys = pw.images
        .map((im) => im.s3_key)
        .filter((k): k is string => typeof k === 'string' && k.length > 0);
      const aspectRatios = pw.images
        .map((im) => im.aspect_ratio)
        .filter((r): r is string => typeof r === 'string');
      const altTexts = pw.images.map((im) => (typeof im.alt_text === 'string' ? im.alt_text : ''));
      return { caption, mediaKeys, aspectRatios, altTexts };
    },
    mintUrl: (key) => store.url(key),
    findSuccessfulPublish,
    recordPublish: (entry) => insertPublishLog(entry),
    setStatus: (postId, status) => updatePostStatus(postId, status).then(() => undefined),
    adapter: createPublisher(platform),
    onFailure: (message) => {
      // TODO go-live: surface to the Slack ops channel via the Hermes gateway.
      console.error('[publish:failure]', message);
    },
  };
}

/** In-process idempotency for the DB-free path (keyed `${postId}:${platform}`). */
const inMemoryPublished = new Map<string, string>();

export interface InMemoryPublishOptions {
  /** Resolve the post from a non-DB source (an in-memory or store-backed Slack draft). Sync or async. */
  resolve: (postId: string) => ResolvedPost | null | Promise<ResolvedPost | null>;
  setStatus?: (postId: string, status: PostStatus) => void | Promise<void>;
  onFailure?: (message: string) => void;
  /** Durable idempotency overrides — back the dedupe with the persistent draft store so it survives restarts. */
  findSuccessfulPublish?: (postId: string, platform: PublishPlatform) => Promise<string | null>;
  recordPublish?: (entry: { postId: string; platform: PublishPlatform; externalId: string | null; status: 'success' | 'failed'; error?: string }) => Promise<void>;
}

/**
 * Publish deps that need NO database — resolves the post from the caller (an in-memory draft session) and
 * mints URLs from the object store. Same approval gate + idempotency + state machine as `makePublishDeps`;
 * the real (gated) platform adapter still applies, so without creds/public URLs publishing fails-safe.
 * Lets the Slack review loop run end-to-end before Supabase (`DATABASE_URL`) is connected.
 */
export function makeInMemoryPublishDeps(platform: PublishPlatform, opts: InMemoryPublishOptions): PublishDeps {
  const store = createObjectStore();
  return {
    async resolvePost(postId: string): Promise<ResolvedPost | null> {
      return opts.resolve(postId);
    },
    mintUrl: (key) => store.url(key),
    // Prefer the caller's durable dedupe (draft-store backed); fall back to the in-process map.
    findSuccessfulPublish:
      opts.findSuccessfulPublish ?? (async (postId, p) => inMemoryPublished.get(`${postId}:${p}`) ?? null),
    recordPublish:
      opts.recordPublish ??
      (async (entry) => {
        if (entry.status === 'success' && entry.externalId) inMemoryPublished.set(`${entry.postId}:${entry.platform}`, entry.externalId);
      }),
    setStatus: async (postId, status) => {
      await opts.setStatus?.(postId, status);
    },
    adapter: createPublisher(platform),
    onFailure: opts.onFailure,
  };
}
