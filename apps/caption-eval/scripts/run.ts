/**
 * Caption gate (PROVISIONAL) — drafts ~15 fresh posts to ./caption-gate/ for human judgment.
 * Run from repo root: node --env-file=.env --import tsx apps/caption-eval/scripts/run.ts
 * (or: pnpm --filter @rss/caption-eval gate)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { draftCaption } from '../src/draft.js';
import type { Platform, PostFormat } from '@rss/core';

const MODEL = process.env.BEDROCK_MODEL || '';
if (!MODEL) {
  console.error('Set BEDROCK_MODEL (region-prefixed Bedrock inference-profile id, e.g. eu.anthropic.claude-...) in .env — Directive 02.');
  process.exit(1);
}
const OUT = 'caption-gate';

const ideas: { idea: string; platform: Platform; format: PostFormat }[] = [
  { idea: 'Why mock interviews beat re-reading your notes the night before', platform: 'linkedin', format: 'single_image' },
  { idea: "The CV line that gets you caught in the first two minutes of an interview", platform: 'linkedin', format: 'carousel' },
  { idea: 'What placement-season anxiety is actually telling you', platform: 'instagram', format: 'single_image' },
  { idea: '"Tell me about yourself" — why your rehearsed answer fools no one', platform: 'linkedin', format: 'single_image' },
  { idea: 'Prepping for a specific company vs. generic interview prep', platform: 'instagram', format: 'carousel' },
  { idea: 'The gap between knowing the framework and saying it under pressure', platform: 'linkedin', format: 'single_image' },
  { idea: 'Aptitude is not the hard part — explaining your reasoning out loud is', platform: 'instagram', format: 'single_image' },
  { idea: "The blind spot an AI coach catches that a friend won't tell you", platform: 'linkedin', format: 'single_image' },
  { idea: 'GD-PI: the moment the panel decides, and it is not when you think', platform: 'linkedin', format: 'carousel' },
  { idea: 'Summer-placement prep: what to actually do six weeks out', platform: 'instagram', format: 'carousel' },
  { idea: 'Why "just be authentic" is useless advice for an IIM interview', platform: 'linkedin', format: 'single_image' },
  { idea: 'The difference between practicing and rehearsing', platform: 'instagram', format: 'single_image' },
  { idea: 'Lateral-switch interviews: the question that exposes job-hoppers', platform: 'linkedin', format: 'single_image' },
  { idea: 'The same three mistakes that show up across hundreds of mock interviews', platform: 'linkedin', format: 'single_image' },
  { idea: 'Your answer was technically correct and still cost you the offer', platform: 'instagram', format: 'single_image' },
];

mkdirSync(OUT, { recursive: true });
const index: string[] = [
  '# Caption gate — sample drafts (PROVISIONAL)',
  '',
  `Model: ${MODEL} · ${ideas.length} ideas · CTA/hashtags STUBBED (gate cannot close until real values land).`,
  'Judge each: on-brand voice? fresh angle (not a rehashed brief)? publishable with light edits?',
  '',
];

let bannedCount = 0;
for (let i = 0; i < ideas.length; i++) {
  const idea = ideas[i]!;
  const n = String(i + 1).padStart(2, '0');
  process.stdout.write(`[${n}/${ideas.length}] ${idea.platform}/${idea.format} — ${idea.idea.slice(0, 48)}…\n`);
  try {
    const d = await draftCaption(idea, MODEL);
    if (d.banned.length) bannedCount++;
    const md = [
      `# ${i + 1}. ${idea.idea}`,
      `**${idea.platform} · ${idea.format}**  ·  model: ${MODEL}`,
      '',
      `**Hook:** ${d.hook}`,
      '',
      '## Caption body',
      '',
      d.caption_body,
      '',
      `**Visual concept:** ${d.visual_concept}`,
      '',
      `**Rationale:** ${d.rationale}`,
      d.banned.length ? `\n> ⚠️ Banned phrases detected: ${d.banned.join(', ')}` : '',
    ].join('\n');
    writeFileSync(join(OUT, `${n}-${idea.platform}-${idea.format}.md`), md + '\n');
    index.push(`- **${n}** ${idea.platform}/${idea.format} — ${idea.idea}${d.banned.length ? '  ⚠️ banned' : ''}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`   failed: ${msg}\n`);
    index.push(`- **${n}** FAILED — ${msg}`);
  }
}

writeFileSync(join(OUT, 'index.md'), index.join('\n') + '\n');
console.log(`\nDone → ./${OUT}/ (open index.md). Banned-phrase flags: ${bannedCount}. Gate is PROVISIONAL until real CTA/hashtags land.`);
