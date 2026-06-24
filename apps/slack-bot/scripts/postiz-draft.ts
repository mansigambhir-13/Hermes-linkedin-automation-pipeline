/**
 * One-shot Postiz publish for a `Sample content ` post — no Slack interactivity needed.
 *   pnpm --filter @rss/slack-bot postiz-draft <topic> [now|draft]   (default mode: draft)
 *
 * draft → created in the Postiz dashboard, nothing public.  now → real public post.
 * Caption is em-dash sanitized; image uploaded from the local PNG. Prints the Postiz id and posts
 * a confirmation line to SLACK_INTAKE_CHANNEL.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WebClient } from '@slack/web-api';
import { PostizClient, extractPostId, postizSettings } from '@rss/publisher';
import { sanitizeCaption } from '@rss/core';

const CONTENT_DIR = 'Sample content ';
const topic = (process.argv[2] ?? 'anchoring').replace(/\.md$/, '');
const mode = (process.argv[3] === 'now' ? 'now' : 'draft') as 'now' | 'draft';
const integration = process.env.POSTIZ_INTEGRATION_LINKEDIN!;
const channel = process.env.SLACK_INTAKE_CHANNEL;

function captionOf(t: string): string {
  const md = readFileSync(join(CONTENT_DIR, `${t}.md`), 'utf8');
  const m = /^##\s+Suggested caption\s*$/im.exec(md);
  const body = m ? md.slice(m.index + m[0].length) : md;
  const next = m ? /^##\s+/m.exec(body) : null;
  return sanitizeCaption((m ? body.slice(0, next ? next.index : undefined) : body).trim());
}

const client = new PostizClient();
const channels = await client.listIntegrations();
const ch = channels.find((c) => c.id === integration);
if (!ch) { console.error(`integration ${integration} not connected`); process.exit(1); }
const type = ch.identifier ?? ch.providerIdentifier ?? 'linkedin';

const png = join(CONTENT_DIR, `${topic}.png`);
const images = existsSync(png) ? [await client.uploadFromFile(readFileSync(png), `${topic}.png`, 'image/png')] : [];
console.log(`uploaded ${images.length} image(s); channel=${ch.name} type=${type}; mode=${mode}`);

const resp = await client.createPost({
  type: mode,
  date: new Date().toISOString(),
  shortLink: false,
  tags: [],
  posts: [{ integration: { id: integration }, value: [{ content: captionOf(topic), image: images }], settings: postizSettings(type) }],
});
const id = extractPostId(resp);
console.log(`✅ ${mode === 'now' ? 'published live' : 'created Postiz draft'} — topic=${topic} postiz_id=${id}`);

if (channel && process.env.SLACK_BOT_TOKEN) {
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  await slack.chat.postMessage({
    channel,
    text: `${mode === 'now' ? '🚀 Published live' : '📝 Postiz draft created'} — ${topic} (id ${id})`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `${mode === 'now' ? '🚀 *Published live* to LinkedIn' : '📝 *Postiz draft created* (nothing public)'} — \`${topic}\` on *${ch.name}* (\`${type}\`).\n*Postiz id:* \`${id}\`` } }],
  });
}
