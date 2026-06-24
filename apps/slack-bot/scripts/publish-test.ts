/**
 * Live publish TEST through Slack (Socket Mode).
 *
 *   pnpm --filter @rss/slack-bot publish-test [topic]   (default topic: anchoring)
 *
 * Posts one card for a `Sample content ` post to #rehearsal-social with two buttons:
 *   🚀 Publish live   → Postiz type 'now'  → real public post on the GradelessAI LinkedIn page
 *   📝 Postiz draft   → Postiz type 'draft'→ created in the Postiz dashboard, nothing public
 *
 * Your click is the authorization — nothing is published until you tap. Exercises the real Postiz
 * publish path (upload local image → create post). Leave this process running; Ctrl-C to stop.
 *
 * Needs in .env: SLACK_BOT_TOKEN, SLACK_APP_TOKEN (Socket Mode), SLACK_INTAKE_CHANNEL,
 *                POSTIZ_API_KEY, POSTIZ_INTEGRATION_LINKEDIN.
 */
import pkg from '@slack/bolt';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PostizClient, extractPostId, postizSettings } from '@rss/publisher';
import { sanitizeCaption } from '@rss/core';

const { App, LogLevel } = pkg;

const CONTENT_DIR = 'Sample content ';
const channel = process.env.SLACK_INTAKE_CHANNEL!;
const topic = (process.argv[2] ?? 'anchoring').replace(/\.md$/, '');
const integration = process.env.POSTIZ_INTEGRATION_LINKEDIN;

for (const [k, v] of Object.entries({ SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN, SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN, SLACK_INTAKE_CHANNEL: channel, POSTIZ_INTEGRATION_LINKEDIN: integration })) {
  if (!v) { console.error(`Missing ${k} in .env`); process.exit(1); }
}

function captionOf(t: string): string {
  const md = readFileSync(join(CONTENT_DIR, `${t}.md`), 'utf8');
  const m = /^##\s+Suggested caption\s*$/im.exec(md);
  if (!m) return sanitizeCaption(md.trim());
  const rest = md.slice(m.index + m[0].length);
  const next = /^##\s+/m.exec(rest);
  return sanitizeCaption(rest.slice(0, next ? next.index : undefined).trim());
}

async function publish(t: string, mode: 'now' | 'draft'): Promise<{ id: string; type: string }> {
  const client = new PostizClient();
  const channels = await client.listIntegrations();
  const ch = channels.find((c) => c.id === integration);
  if (!ch) throw new Error(`integration id ${integration} not found among connected channels`);
  const type = ch.identifier ?? ch.providerIdentifier ?? 'linkedin';

  const pngPath = join(CONTENT_DIR, `${t}.png`);
  const images = existsSync(pngPath)
    ? [await client.uploadFromFile(readFileSync(pngPath), `${t}.png`, 'image/png')]
    : [];

  const resp = await client.createPost({
    type: mode,
    date: new Date().toISOString(),
    shortLink: false,
    tags: [],
    posts: [{ integration: { id: integration! }, value: [{ content: captionOf(t), image: images }], settings: postizSettings(type) }],
  });
  return { id: extractPostId(resp), type };
}

const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true, logLevel: LogLevel.WARN });

function buttons(t: string) {
  return [
    {
      type: 'actions',
      elements: [
        { type: 'button', style: 'primary', text: { type: 'plain_text', text: '🚀 Publish live' }, action_id: 'pub_live', value: t, confirm: { title: { type: 'plain_text', text: 'Publish live to LinkedIn?' }, text: { type: 'mrkdwn', text: 'This posts publicly on the *GradelessAI* LinkedIn page right now.' }, confirm: { type: 'plain_text', text: 'Publish' }, deny: { type: 'plain_text', text: 'Cancel' } } },
        { type: 'button', text: { type: 'plain_text', text: '📝 Postiz draft (safe)' }, action_id: 'pub_draft', value: t },
      ],
    },
  ];
}

async function handle(mode: 'now' | 'draft', body: any, client: any) {
  const t = body.actions[0].value as string;
  const ts = body.message.ts;
  const user = body.user?.id;
  await client.chat.update({ channel, ts, text: `⏳ Publishing ${t} (${mode})…`, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `⏳ <@${user}> triggered *${mode === 'now' ? 'live publish' : 'Postiz draft'}* for \`${t}\`…` } }] });
  try {
    const { id, type } = await publish(t, mode);
    const label = mode === 'now' ? `🚀 *Published live* to LinkedIn (\`${type}\`)` : `📝 *Created as Postiz draft* (\`${type}\`)`;
    await client.chat.update({ channel, ts, text: `done: ${t}`, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `${label}\n*Post:* \`${t}\`  ·  *Postiz id:* \`${id}\`  ·  by <@${user}>${mode === 'draft' ? '\n_Open Postiz to review/publish it._' : ''}` } }] });
    console.log(`✅ ${t} ${mode} → ${id}`);
  } catch (e) {
    await client.chat.update({ channel, ts, text: `failed: ${t}`, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `⛔ Publish failed for \`${t}\`: ${(e as Error).message}` } }, ...buttons(t)] });
    console.error(`❌ ${t} ${mode}: ${(e as Error).message}`);
  }
}

app.action('pub_live', async ({ ack, body, client }) => { await ack(); await handle('now', body, client); });
app.action('pub_draft', async ({ ack, body, client }) => { await ack(); await handle('draft', body, client); });

await app.start();
const preview = captionOf(topic).slice(0, 400);
await app.client.chat.postMessage({
  channel,
  text: `Publish test: ${topic}`,
  blocks: [
    { type: 'header', text: { type: 'plain_text', text: `🧪 Publish test — ${topic}` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `*Target:* GradelessAI LinkedIn page  ·  *Source:* \`${topic}.md\` + \`${topic}.png\`` }] },
    { type: 'section', text: { type: 'mrkdwn', text: `*Caption:*\n${preview}${preview.length >= 400 ? '…' : ''}` } },
    ...buttons(topic),
  ],
});
const png = join(CONTENT_DIR, `${topic}.png`);
if (existsSync(png)) {
  try { await app.client.filesUploadV2({ channel_id: channel, file: readFileSync(png), filename: `${topic}.png`, title: `${topic} — image to publish` }); } catch { /* preview is best-effort */ }
}
console.log(`🧪 Publish test card posted to ${channel} for "${topic}". Click a button in Slack. Ctrl-C to stop.`);
