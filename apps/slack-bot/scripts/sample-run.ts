/**
 * Sample automation (review-only, no publishing):
 *   ingest `Sample content ` glossary posts → Claude validatePost verdict → post a review card
 *   (with the rendered image) to Slack. Demonstrates the decision + distribution path end-to-end.
 *
 * Run:  pnpm --filter @rss/slack-bot sample-run [count]
 *   count = how many posts to process (default 3). `all` for every post.
 *
 * Needs in .env: ANTHROPIC_API_KEY, SLACK_BOT_TOKEN, SLACK_INTAKE_CHANNEL.
 * Does NOT publish anywhere — actual posting stays behind the human Approve gate in the running bot.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WebClient } from '@slack/web-api';
import { validatePost, type Verdict } from '@rss/agent';
import { sanitizeCaption } from '@rss/core';

const CONTENT_DIR = 'Sample content '; // note: trailing space is part of the folder name
const channel = process.env.SLACK_INTAKE_CHANNEL;
const token = process.env.SLACK_BOT_TOKEN;
if (!channel || !token) {
  console.error('Missing SLACK_BOT_TOKEN or SLACK_INTAKE_CHANNEL in .env');
  process.exit(1);
}
const slack = new WebClient(token);

const arg = process.argv[2] ?? '3';

interface ParsedPost {
  topic: string;
  title: string;
  pillar: string;
  platform: string;
  caption: string;
  imagePath?: string;
}

function section(md: string, heading: string): string | undefined {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
  const m = re.exec(md);
  if (!m) return undefined;
  const start = m.index + m[0].length;
  const rest = md.slice(start);
  const next = /^##\s+/m.exec(rest);
  return rest.slice(0, next ? next.index : undefined).trim();
}

function field(md: string, label: string): string | undefined {
  const m = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, 'im').exec(md);
  return m?.[1]?.trim();
}

function parse(file: string): ParsedPost {
  const md = readFileSync(join(CONTENT_DIR, file), 'utf8');
  const topic = file.replace(/\.md$/, '');
  const title = (/^#\s+(.+)$/m.exec(md)?.[1] ?? topic).trim();
  const pillar = (field(md, 'Pillar') ?? 'glossary').split('(')[0]!.trim();
  const platform = (field(md, 'Platform') ?? 'LinkedIn').toLowerCase().includes('linkedin') ? 'linkedin' : 'linkedin';
  const caption = sanitizeCaption(section(md, 'Suggested caption') ?? section(md, 'What it means \\(brand voice\\)') ?? md);
  const png = join(CONTENT_DIR, `${topic}.png`);
  return { topic, title, pillar, platform, caption, imagePath: existsSync(png) ? png : undefined };
}

const ICON: Record<Verdict['decision'], string> = { approve: '✅', hold: '⏸️', flag: '🚩' };

function checkLine(v: Verdict): string {
  const c = v.voiceChecks;
  const mark = (b: boolean) => (b ? '✓' : '✗');
  return (
    `3rd-person ${mark(c.thirdPerson)} · no-! ${mark(c.noExclamation)} · no-emdash ${mark(c.noEmDashes)} · no-banned ${mark(c.noBannedPhrases)} · ` +
    `numbers ${mark(c.specificNumbers)} · no-coaching ${mark(c.noMotivationalCoaching)} · no-dunk ${mark(c.noCompetitorDunking)}`
  );
}

async function postCard(p: ParsedPost, v: Verdict): Promise<void> {
  const preview = p.caption.length > 600 ? p.caption.slice(0, 600).trimEnd() + '…' : p.caption;
  const res = await slack.chat.postMessage({
    channel: channel!,
    text: `${ICON[v.decision]} ${v.decision.toUpperCase()} — ${p.title}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${ICON[v.decision]} ${v.decision.toUpperCase()} — ${p.title}` } },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `*Pillar:* ${p.pillar}  ·  *Platform:* ${p.platform}  ·  *Source:* \`${p.topic}.md\`` }],
      },
      { type: 'section', text: { type: 'mrkdwn', text: `*Why:*\n${v.reasons.map((r) => `• ${r}`).join('\n')}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `*Voice checks:* ${checkLine(v)}` }] },
      ...(v.suggestedEdits?.length
        ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Suggested edits:*\n${v.suggestedEdits.map((e) => `• ${e}`).join('\n')}` } }]
        : []),
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `*Caption preview:*\n${preview}` } },
    ] as any,
  });
  // Attach the rendered image as a threaded reply so the card stays compact.
  if (p.imagePath && res.ts) {
    try {
      await slack.filesUploadV2({
        channel_id: channel!,
        thread_ts: res.ts as string,
        file: readFileSync(p.imagePath),
        filename: `${p.topic}.png`,
        title: `${p.title} — rendered image`,
      });
    } catch (e) {
      await slack.chat.postMessage({ channel: channel!, thread_ts: res.ts as string, text: `(image upload skipped: ${(e as Error).message})` });
    }
  }
}

// ── run ──
const all = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort();
const files = arg === 'all' ? all : all.slice(0, Math.max(1, parseInt(arg, 10) || 3));
console.log(`Processing ${files.length} of ${all.length} posts → #${channel}\n`);

const tally: Record<string, number> = { approve: 0, hold: 0, flag: 0 };
for (const f of files) {
  const p = parse(f);
  process.stdout.write(`• ${p.topic} … `);
  try {
    const v = await validatePost({ platform: p.platform, pillar: p.pillar, caption: p.caption, meta: { topic: p.topic, title: p.title } });
    tally[v.decision] = (tally[v.decision] ?? 0) + 1;
    await postCard(p, v);
    console.log(`${ICON[v.decision]} ${v.decision}`);
  } catch (e) {
    console.log(`❌ ${(e as Error).message}`);
  }
}
console.log(`\nDone. Verdicts → approve:${tally.approve} hold:${tally.hold} flag:${tally.flag}. Cards posted to #rehearsal-social.`);
