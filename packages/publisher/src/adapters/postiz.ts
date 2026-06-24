import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sanitizeCaption, type PublishPlatform } from '@rss/core';
import type { PublishRequest, PublishResult, PublisherAdapter } from '../types.js';
import { PublishPreconditionError } from '../types.js';
import { PostizClient, extractPostId, postizSettings, type PostizUpload } from '../postiz.js';

/**
 * Postiz-backed publisher — one-click posting via the Postiz public API.
 *
 * Postiz owns OAuth + media + the platform quirks, so the flow is just:
 *   1. upload each media asset (POST /upload) → { id, path }
 *   2. create the post (POST /posts, type 'now') on the connected integration → external id
 *
 * Multiple images on a LinkedIn post become a carousel automatically — no format branching needed.
 *
 * Config: POSTIZ_API_KEY, optional POSTIZ_API_URL, and one integration id per platform:
 *   POSTIZ_INTEGRATION_LINKEDIN, POSTIZ_INTEGRATION_INSTAGRAM (get ids via `pnpm --filter @rss/publisher postiz-channels`).
 *
 * settings.__type must match the channel's Postiz provider exactly — e.g. a company page is
 * `linkedin-page`, not `linkedin`. We derive it from the integration itself (GET /integrations) so
 * page vs personal vs IG-business all just work; the platform map is only a fallback.
 */
const FALLBACK_TYPE: Record<PublishPlatform, string> = {
  linkedin: 'linkedin',
  instagram: 'instagram',
  x: 'x',
};

function integrationId(platform: PublishPlatform): string | undefined {
  const v = process.env[`POSTIZ_INTEGRATION_${platform.toUpperCase()}`];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

function filenameFor(url: string, index: number): string {
  const path = url.split('?')[0] ?? url;
  const last = path.slice(path.lastIndexOf('/') + 1);
  return last && /\.[a-z0-9]{2,4}$/i.test(last) ? last : `media-${index}.png`;
}

export class PostizPublisher implements PublisherAdapter {
  async publish(req: PublishRequest): Promise<PublishResult> {
    const integration = integrationId(req.platform);
    if (!integration) {
      throw new PublishPreconditionError(
        `Postiz: no integration id for ${req.platform}. Run \`pnpm --filter @rss/publisher postiz-channels\` ` +
          `and set POSTIZ_INTEGRATION_${req.platform.toUpperCase()} in .env.`,
      );
    }
    const client = new PostizClient(); // throws PublishPreconditionError if POSTIZ_API_KEY is unset

    // Resolve the channel's real provider (e.g. 'linkedin-page') for settings.__type; fall back to the platform map.
    let type: string = FALLBACK_TYPE[req.platform];
    const channels = await client.listIntegrations();
    const channel = channels.find((c) => c.id === integration);
    if (!channel) {
      throw new PublishPreconditionError(
        `Postiz: integration id "${integration}" (POSTIZ_INTEGRATION_${req.platform.toUpperCase()}) is not a connected channel. ` +
          `Run \`pnpm --filter @rss/publisher postiz-channels\` to see valid ids.`,
      );
    }
    type = channel.identifier ?? channel.providerIdentifier ?? type;

    // NOTE: req.altTexts is carried this far but NOT forwarded — the Postiz public API's image entries
    // accept only { id, path } (verified against docs.postiz.com, 2026-06-04); there is no alt-text field.
    // Revisit if Postiz adds one.
    const images: PostizUpload[] = [];
    for (let i = 0; i < req.mediaUrls.length; i++) {
      const url = req.mediaUrls[i]!;
      const name = filenameFor(url, i);
      if (/^https?:\/\//i.test(url)) {
        images.push(await client.uploadFromUrl(url, name)); // public URL (S3 etc.) — Postiz fetches it
      } else {
        const path = url.startsWith('file://') ? fileURLToPath(url) : url; // local artifact (pre-made / dev)
        images.push(await client.uploadFromFile(readFileSync(path), name, 'image/png'));
      }
    }

    // X thread → one value[] entry per tweet (lead image on tweet 1); everything else → a single entry.
    const value =
      req.platform === 'x' && req.thread && req.thread.length > 1
        ? req.thread.map((tweet, i) => ({ content: sanitizeCaption(tweet), image: i === 0 ? images : [] }))
        : [{ content: sanitizeCaption(req.caption), image: images }]; // Postiz requires image[] always (empty for text-only)

    const resp = await client.createPost({
      type: 'now',
      date: new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: [{ integration: { id: integration }, value, settings: postizSettings(type) }],
    });
    return { externalId: extractPostId(resp) };
  }
}
