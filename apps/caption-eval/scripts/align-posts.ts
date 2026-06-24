/**
 * Aligned posts + carousels (Directive 04 probe).
 * Reads the approved caption drafts in ./caption-gate/, then generates the matching VISUALS via the image
 * engine (fal) and writes complete posts (caption + image paths) to ./aligned-posts/.
 *
 *  - single_image  → an editorial hero from the caption's visual_concept (no text; the caption carries words),
 *                    OR a poster (hook typeset in) for ids in POSTER_IDS — tests in-image text via Ideogram.
 *  - carousel      → draftSlides() turns the caption into N rich slide concepts; assembleCarousel pins ONE
 *                    style-spec + seed + uniform ratio (the consistency anchor; recraft has no seed).
 *
 * Per Directive 04's stopping rule we PROBE a subset first (PROBE_IDS), judge, then scale.
 * Run from repo root:
 *   node --env-file=.env --import tsx apps/caption-eval/scripts/align-posts.ts
 *   PROBE_IDS=1,2,7,11 POSTER_IDS=11 CAROUSEL_SLIDES=4 node --env-file=.env --import tsx apps/caption-eval/scripts/align-posts.ts
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ImageEngine } from '@rss/image';
import { draftSlides } from '../src/draft.js';
import type { AspectRatio, ImageJobType, Platform, PostFormat, StyleSpec } from '@rss/core';

const MODEL = process.env.BEDROCK_MODEL || '';
const ARTIFACTS = process.env.LOCAL_ARTIFACTS_DIR || '.artifacts';
const SRC = 'caption-gate';
const OUT = 'aligned-posts';
const PROBE_IDS = (process.env.PROBE_IDS || '1,2,7,11').split(',').map((s) => Number(s.trim()));
const POSTER_IDS = new Set((process.env.POSTER_IDS || '11').split(',').map((s) => Number(s.trim())));
const CAROUSEL_SLIDES = Number(process.env.CAROUSEL_SLIDES || '4');
// Which model carousel slides route to. 'carousel_slide' = recraft (text-happy, no seed); 'hero' = Imagen4
// (respects "no text", honors the pinned seed → consistency). Probe found recraft invents garbled text.
const CAROUSEL_JOB = (process.env.CAROUSEL_JOB as ImageJobType) || 'hero';

/** The single locked carousel style spec — same world across every slide (the consistency control). */
const REHEARSAL_STYLE: StyleSpec = {
  palette: ['#0a0a0a', '#9677f8', '#4e44fd', '#ff4859', '#00c483', '#f5f5f5'],
  type_treatment: 'Raleway sans; large confident headline; generous negative space',
  layout_grammar: 'one focal idea per slide; dark near-black canvas; signature gradient on a single element',
  illustration_style: 'conceptual editorial illustration; modern, a little cinematic; never literal stock',
};

interface ParsedPost {
  id: number;
  file: string;
  title: string;
  platform: Platform;
  format: PostFormat;
  hook: string;
  body: string;
  visualConcept: string;
}

function parseDraft(file: string, text: string): ParsedPost | null {
  const id = Number(/^(\d+)/.exec(file)?.[1]);
  const title = /^#\s*\d+\.\s*(.+)$/m.exec(text)?.[1]?.trim() ?? file;
  const pf = /\*\*(\w+)\s*·\s*(\w+)\*\*/.exec(text);
  const hook = /\*\*Hook:\*\*\s*(.+)/.exec(text)?.[1]?.trim() ?? '';
  const visualConcept = /\*\*Visual concept:\*\*\s*([\s\S]+?)(?:\n\n|\*\*Rationale)/.exec(text)?.[1]?.trim() ?? '';
  const bodyMatch = /##\s*Caption body\s*\n([\s\S]+?)\n\s*\*\*Visual concept:/.exec(text);
  if (!pf || !bodyMatch || !Number.isFinite(id)) return null;
  return {
    id,
    file,
    title,
    platform: pf[1] as Platform,
    format: pf[2] as PostFormat,
    hook,
    body: bodyMatch[1]!.trim(),
    visualConcept,
  };
}

function ratioFor(p: ParsedPost, poster: boolean): AspectRatio {
  if (p.format === 'carousel') return '1:1';
  if (poster) return p.platform === 'instagram' ? '4:5' : '1:1';
  return p.platform === 'instagram' ? '4:5' : '1.91:1';
}

const localPath = (storageKey: string): string => `${ARTIFACTS}/${storageKey}`;

async function main(): Promise<void> {
  if (!MODEL) {
    console.error('Set BEDROCK_MODEL in .env (carousel slide-building needs it).');
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  const engine = new ImageEngine();

  const files = readdirSync(SRC).filter((f) => /^\d+-.*\.md$/.test(f)).sort();
  const posts = files
    .map((f) => parseDraft(f, readFileSync(join(SRC, f), 'utf8')))
    .filter((p): p is ParsedPost => p !== null && PROBE_IDS.includes(p.id));

  console.log(`Probe set: ${posts.map((p) => p.id).join(', ')} (of ${files.length} drafts). Model: ${MODEL}.`);
  const index: string[] = [
    '# Aligned posts + carousels (Directive 04 probe)',
    '',
    `Probe ids: ${PROBE_IDS.join(', ')} · poster ids: ${[...POSTER_IDS].join(', ')} · carousel slides: ${CAROUSEL_SLIDES}.`,
    'Each post pairs the approved caption with its generated visual(s). Judge: on-topic? on-brand? (poster) text clean? (carousel) consistent across slides?',
    '',
  ];

  for (const p of posts) {
    const nn = String(p.id).padStart(2, '0');
    const postId = `aligned-${nn}`;
    process.stdout.write(`[${nn}] ${p.platform}/${p.format} — ${p.title.slice(0, 50)}…\n`);
    const md: string[] = [
      `# ${p.id}. ${p.title}`,
      `**${p.platform} · ${p.format}**  ·  caption model: ${MODEL}`,
      '',
      `**Hook:** ${p.hook}`,
      '',
      '## Caption body',
      '',
      p.body,
      '',
      `**Seed visual concept:** ${p.visualConcept}`,
      '',
      '## Generated visual(s)',
      '',
    ];

    try {
      if (p.format === 'carousel') {
        const slides = await draftSlides(
          { idea: p.title, hook: p.hook, body: p.body, visualConcept: p.visualConcept, platform: p.platform, n: CAROUSEL_SLIDES },
          MODEL,
        );
        process.stdout.write(`     ${slides.length} slide concepts → rendering carousel…\n`);
        const refs = await engine.assembleCarousel({
          postId,
          aspectRatio: ratioFor(p, false),
          styleSpec: REHEARSAL_STYLE,
          seed: 7,
          slides: slides.map((s) => ({ concept: s.concept, jobType: CAROUSEL_JOB })), // editorial, consistency-focused
        });
        md.push(`Carousel · ${refs.length} slides · ${refs[0]?.modelUsed} · seed-pinned · ratio ${ratioFor(p, false)} (uniform).`, '');
        refs.forEach((r, i) => {
          md.push(`### Slide ${i + 1} — ${slides[i]!.headline}`, `_${slides[i]!.concept}_`, '', `![slide ${i + 1}](${localPath(r.storageKey)})`, '');
        });
      } else {
        const poster = POSTER_IDS.has(p.id);
        const ratio = ratioFor(p, poster);
        const ref = await engine.generateSingle({
          postId,
          jobType: poster ? 'statement' : 'hero',
          concept: p.visualConcept,
          headlineText: poster ? p.hook : undefined,
          aspectRatio: ratio,
        });
        md.push(
          `${poster ? 'Poster (hook typeset in)' : 'Editorial hero (no text)'} · ${ref.modelUsed} · ratio ${ratio}.`,
          '',
          `![${postId}](${localPath(ref.storageKey)})`,
          '',
        );
      }
      index.push(`- **${nn}** ${p.platform}/${p.format}${p.format === 'carousel' ? ' (carousel)' : POSTER_IDS.has(p.id) ? ' (poster)' : ' (editorial)'} — ${p.title}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`     failed: ${msg}\n`);
      md.push(`> ⚠️ generation failed: ${msg}`);
      index.push(`- **${nn}** FAILED — ${msg}`);
    }

    writeFileSync(join(OUT, `${nn}-${p.platform}-${p.format}.md`), md.join('\n') + '\n');
  }

  writeFileSync(join(OUT, 'index.md'), index.join('\n') + '\n');
  console.log(`\nDone → ./${OUT}/ (open index.md). Images under ./${ARTIFACTS}/posts/aligned-*/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
