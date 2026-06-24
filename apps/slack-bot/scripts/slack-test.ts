/**
 * Live Slack test (outbound): create a dummy channel, run the pipeline, and post the real review card + image
 * into Slack via the bot token. Proves the full draft→Slack path against the real workspace. The buttons are
 * shown but inert until an interactivity endpoint is wired (Socket Mode / tunnel) — see infra/slack-setup.md.
 *
 * Run from repo root (cwd matters for artifact paths):
 *   node --env-file=.env --import tsx apps/slack-bot/scripts/slack-test.ts "your idea"
 *   CHANNEL=C0123 PLATFORM=instagram FORMAT=carousel node --env-file=.env --import tsx apps/slack-bot/scripts/slack-test.ts "idea"
 */
import { WebClient } from '@slack/web-api';
import { readFileSync } from 'node:fs';
import { composeDraft } from '@rss/agent';
import { draftBlocks } from '../src/blocks.js';
import type { PostFormat, PublishPlatform } from '@rss/core';

const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error('SLACK_BOT_TOKEN missing in .env');
  process.exit(1);
}
const web = new WebClient(token);

const idea = process.argv.slice(2).join(' ') || 'Why mock interviews beat re-reading your notes the night before';
const platform = (process.env.PLATFORM as PublishPlatform) || 'linkedin';
const format = (process.env.FORMAT as PostFormat) || 'single_image';

const auth = await web.auth.test();
console.log(`✅ auth OK — team "${auth.team}", bot @${auth.user}`);

// Channel: reuse CHANNEL (id) if provided, else create a fresh, clearly-labelled dummy channel (bot auto-joins).
let channel = process.env.CHANNEL;
if (!channel) {
  const name = `rehearsal-bot-test-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const created = await web.conversations.create({ name });
    channel = created.channel?.id ?? undefined;
    console.log(`✅ created #${created.channel?.name} (${channel})`);
  } catch (e: any) {
    console.error(`❌ could not create channel: ${e?.data?.error ?? e.message}. Add the channels:manage scope, or pass CHANNEL=<id> of a channel @${auth.user} is already in.`);
    process.exit(1);
  }
}

console.log(`🛠️  composing ${platform}/${format} for: "${idea}" …`);
const draft = await composeDraft({ idea, platform, format, createdBy: 'slack-test' });
console.log(`   caption ready (${draft.banned.length} banned) + ${draft.images.length} image(s).`);

await web.chat.postMessage({
  channel: channel!,
  text: `🎬 Draft ${draft.postId} ready for review`,
  blocks: draftBlocks(draft) as any,
});
for (const img of draft.images) {
  try {
    await web.files.uploadV2({
      channel_id: channel!,
      filename: `${draft.postId}-${img.slideIndex}.png`,
      title: img.headline ?? `slide ${img.slideIndex + 1}`,
      file: readFileSync(img.localPath),
    });
  } catch (e: any) {
    await web.chat.postMessage({ channel: channel!, text: `(image ${img.slideIndex} not uploaded: ${e?.data?.error ?? e.message}; local: ${img.localPath})` });
  }
}
await web.chat.postMessage({
  channel: channel!,
  text: `ℹ️ This is a live pipeline test. The buttons above are inert until the interactivity endpoint is wired (Socket Mode or a tunnel) — see infra/slack-setup.md.`,
});
console.log(`✅ posted the draft + ${draft.images.length} image(s) to channel ${channel}. Open Slack to review.`);
