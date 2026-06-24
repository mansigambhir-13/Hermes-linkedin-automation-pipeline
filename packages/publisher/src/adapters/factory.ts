import type { PublishPlatform } from '@rss/core';
import type { PublisherAdapter } from '../types.js';
import { StubPublisher } from './stub.js';
import { LinkedInPublisher } from './linkedin.js';
import { InstagramPublisher } from './instagram.js';
import { PostizPublisher } from './postiz.js';

/**
 * Transport selection (fail-safe by design):
 *   PUBLISHER_ADAPTER=stub          → simulate success (dev), no external calls.
 *   POSTIZ_API_KEY set              → Postiz one-click posting (handles OAuth/media/publish).
 *   else                            → the direct platform adapters, which refuse without creds.
 *
 * Postiz is preferred once its key is present so LinkedIn/IG go through a single connected backend.
 * Force the legacy direct adapters even with a Postiz key via PUBLISHER_ADAPTER=direct.
 */
export function createPublisher(platform: PublishPlatform): PublisherAdapter {
  const mode = process.env.PUBLISHER_ADAPTER ?? 'live';
  if (mode === 'stub') return new StubPublisher();
  if (mode !== 'direct' && process.env.POSTIZ_API_KEY) return new PostizPublisher();
  return platform === 'linkedin' ? new LinkedInPublisher() : new InstagramPublisher();
}
