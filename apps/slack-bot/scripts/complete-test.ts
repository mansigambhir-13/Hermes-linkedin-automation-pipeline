/**
 * Complete end-to-end test: one COMPLETE post per platform (LinkedIn, X, Instagram) as Postiz DRAFTS.
 * Verifies the full shape — caption + image, and the X thread published in full — with zero public risk.
 * Uses real brand PNGs (glossary cards) as stand-in test images. Review the drafts in the Postiz dashboard,
 * then publish for real. Run: pnpm --filter @rss/slack-bot complete-test
 */
import { readFileSync } from 'node:fs';
import { createContentLibrary, sanitizeCaption } from '@rss/core';
import { PostizClient, postizSettings, extractPostId } from '@rss/publisher';

const client = new PostizClient();
const channels = await client.listIntegrations();
const lib = createContentLibrary();
const integId = (p: string): string | undefined => process.env[`POSTIZ_INTEGRATION_${p.toUpperCase()}`];

const TESTS: { id: string; img: string }[] = [
  { id: '2026-06-03-case-files-linkedin-paytm-crossroads', img: 'Sample content /rice-score.png' }, // LinkedIn: body + image
  { id: '2026-06-05-case-files-x-paytm-thread', img: 'Sample content /network-effect.png' }, // X: 8-tweet thread + lead image
  { id: '2026-06-06-brief-roulette-instagram-big-four', img: 'Sample content /anchoring.png' }, // Instagram: caption + image (required)
];

for (const t of TESTS) {
  const post = await lib.get(t.id);
  if (!post) {
    console.log(`❌ ${t.id} not found`);
    continue;
  }
  const id = integId(post.platform);
  const ch = channels.find((c) => c.id === id);
  if (!ch) {
    console.log(`❌ no connected channel for ${post.platform}`);
    continue;
  }
  const type = ch.identifier ?? ch.providerIdentifier ?? post.platform;
  const img = await client.uploadFromFile(readFileSync(t.img), t.img.split('/').pop()!, 'image/png');

  // X thread → one entry per tweet (lead image on tweet 1); else a single entry.
  const value =
    post.platform === 'x' && post.thread && post.thread.length > 1
      ? post.thread.map((tweet, i) => ({ content: sanitizeCaption(tweet), image: i === 0 ? [img] : [] }))
      : [{ content: sanitizeCaption(post.caption), image: [img] }];

  try {
    const resp = await client.createPost({
      type: 'draft',
      date: new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: [{ integration: { id: ch.id }, value, settings: postizSettings(type) }],
    });
    console.log(`✅ ${post.platform.toUpperCase().padEnd(9)} draft → ${value.length} ${value.length > 1 ? 'tweets' : 'entry'}, image attached, channel="${ch.name}" (${type})  postiz_id=${extractPostId(resp)}`);
  } catch (e) {
    console.log(`❌ ${post.platform} draft failed: ${(e as Error).message}`);
  }
}
process.exit(0);
