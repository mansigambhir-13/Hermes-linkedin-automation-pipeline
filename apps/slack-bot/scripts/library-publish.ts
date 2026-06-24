/**
 * Publish a content-library post through Postiz (the same path the /posts card uses).
 *   pnpm --filter @rss/slack-bot library-publish <post-id> [now|draft]   (default: draft)
 *
 * draft → lands in the Postiz dashboard, nothing public.  now → real public post.
 * Resolves the integration + __type from the post's platform; uploads a local image if present.
 */
import { readFileSync } from 'node:fs';
import { createContentLibrary, sanitizeCaption } from '@rss/core';
import { PostizClient, extractPostId, postizSettings, type PostizUpload } from '@rss/publisher';

const id = process.argv[2];
const mode = (process.argv[3] === 'now' ? 'now' : 'draft') as 'now' | 'draft';
if (!id) {
  console.error('usage: library-publish <post-id> [now|draft]');
  process.exit(1);
}

const post = await createContentLibrary().get(id);
if (!post) {
  console.error(`post "${id}" not found in the content library`);
  process.exit(1);
}
const integration = process.env[`POSTIZ_INTEGRATION_${post.platform.toUpperCase()}`];
if (!integration) {
  console.error(`no POSTIZ_INTEGRATION_${post.platform.toUpperCase()} set for platform ${post.platform}`);
  process.exit(1);
}

const client = new PostizClient();
const channels = await client.listIntegrations();
const ch = channels.find((c) => c.id === integration);
if (!ch) {
  console.error(`integration ${integration} not connected in Postiz`);
  process.exit(1);
}
const type = ch.identifier ?? ch.providerIdentifier ?? post.platform;

const images: PostizUpload[] = post.imagePath ? [await client.uploadFromFile(readFileSync(post.imagePath), `${post.id}.png`, 'image/png')] : [];
console.log(`post=${post.id} platform=${post.platform} channel="${ch.name}" type=${type} images=${images.length} mode=${mode}`);

const resp = await client.createPost({
  type: mode,
  date: new Date().toISOString(),
  shortLink: false,
  tags: [],
  posts: [{ integration: { id: integration }, value: [{ content: sanitizeCaption(post.caption), image: images }], settings: postizSettings(type) }],
});
console.log(`✅ ${mode === 'now' ? 'PUBLISHED LIVE' : 'created Postiz draft'} — ${post.id} → postiz_id=${extractPostId(resp)}`);
