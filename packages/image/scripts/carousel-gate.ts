/**
 * Carousel-consistency gate (Directive 02 §5.1) — generates real carousels via fal (recraft-v3),
 * one locked style spec + uniform 1:1 across each set, to ./.artifacts/posts/<id>/ for HUMAN judgment.
 * First sample = 5 sets × 3 slides; scale to ~15 sets once the method looks right.
 * Run from repo root: node --env-file=.env --import tsx packages/image/scripts/carousel-gate.ts
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ImageEngine } from '../src/index.js';
import type { StyleSpec } from '@rss/core';

const engine = new ImageEngine(); // fal
const ARTIFACTS = process.env.LOCAL_ARTIFACTS_DIR ?? '.artifacts';

const styleSpec: StyleSpec = {
  palette: ['#0a0a0a', '#ffffff', '#9677f8', '#4e44fd', '#ff4859', '#00c483'],
  type_treatment: 'Raleway; large confident headline; one gradient-filled key word',
  layout_grammar: 'dark near-black field; headline upper-third; generous negative space; one focal idea',
  illustration_style: 'conceptual, metaphorical, modern, a little cinematic; no literal stock',
};

const carousels: { id: string; slides: { concept: string }[] }[] = [
  { id: 'c1-mock-vs-notes', slides: [
    { concept: 'a closed glowing notebook beside an empty, spotlit stage — reading vs rehearsing' },
    { concept: 'a lone figure stepping from shadow into a bright doorway' },
    { concept: 'a single gradient arrow turning a sharp corner' },
  ] },
  { id: 'c2-cv-gaps', slides: [
    { concept: 'a magnifying glass over a resume line that is cracking apart' },
    { concept: 'a panel of silhouettes leaning in, one spotlight on a single weak line' },
    { concept: 'a hand quietly patching the crack before the panel arrives' },
  ] },
  { id: 'c3-under-pressure', slides: [
    { concept: 'a clean framework diagram dissolving into static under a spotlight' },
    { concept: 'a figure at a podium, words turning to a tangled thread mid-air' },
    { concept: 'the tangled thread straightening into one confident line' },
  ] },
  { id: 'c4-specific-company', slides: [
    { concept: 'a row of generic gray buildings, one sharply lit with a labeled doorway' },
    { concept: 'a figure studying a single blueprint while the rest blur' },
    { concept: 'a key cut precisely to fit one specific lock' },
  ] },
  { id: 'c5-same-mistakes', slides: [
    { concept: 'three faint recurring shadows trailing a confident figure' },
    { concept: 'a mirror showing the same stumble three times' },
    { concept: 'the figure stepping past the shadows into clean light' },
  ] },
];

mkdirSync(join(ARTIFACTS, 'carousel-gate'), { recursive: true });
const index: string[] = [
  '# Carousel-consistency gate — real fal renders',
  '',
  'Model: fal-ai/recraft-v3 (carousel_slide) · one locked style spec · uniform 1:1 · NO seed (recraft).',
  'Judge each set: identical palette? identical type treatment? one illustration "hand"? consistent layout? any slide off-brand?',
  'Open the images at .artifacts/posts/<id>/.',
  '',
];

let ok = 0;
let fail = 0;
for (const c of carousels) {
  process.stdout.write(`rendering ${c.id} (${c.slides.length} slides)…\n`);
  try {
    const refs = await engine.assembleCarousel({ postId: c.id, aspectRatio: '1:1', styleSpec, seed: 7, slides: c.slides });
    const sizes = refs.map((r) => {
      try {
        return statSync(join(ARTIFACTS, r.storageKey)).size;
      } catch {
        return 0;
      }
    });
    ok++;
    index.push(`- **${c.id}** → ${refs.length} slides at \`.artifacts/posts/${c.id}/\` · bytes: ${sizes.join(', ')} · ${refs[0]?.modelUsed ?? '?'}`);
  } catch (e) {
    fail++;
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`  failed: ${msg}\n`);
    index.push(`- **${c.id}** FAILED — ${msg}`);
  }
}

writeFileSync(join(ARTIFACTS, 'carousel-gate', 'index.md'), index.join('\n') + '\n');
console.log(`\nDone — ${ok} sets ok, ${fail} failed → open .artifacts/posts/<id>/ + .artifacts/carousel-gate/index.md`);
process.exit(fail > 0 && ok === 0 ? 1 : 0);
