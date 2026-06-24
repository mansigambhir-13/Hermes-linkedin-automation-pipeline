/**
 * Directive 04, Upgrade C — compute the brand-style grounding ONCE and cache it.
 * Describes the real Rehearsal brand visuals via a Gemini vision model on fal, then writes the description to
 * config/brand-style.grounding.txt, which the ImageEngine injects into every image prompt.
 *
 * Run from repo root (cwd matters for the image + output paths):
 *   node --env-file=.env --import tsx packages/image/scripts/ground-brand.ts
 *   (or: pnpm --filter @rss/image ground)   ← cds to root for you
 * Pass explicit image paths as args to override the default set.
 */
import { writeFileSync } from 'node:fs';
import { describeBrandStyle } from '../src/grounding.js';

const ASSETS = 'brand-assets/landing-screenshots';
const DEFAULT_IMAGES = [
  `${ASSETS}/01-hero-think-like-an-mba.png`,
  `${ASSETS}/02-everybody-talks.png`,
  `${ASSETS}/05-same-brain-different-answer.png`,
  `${ASSETS}/08-taught-in-stories.png`,
  `${ASSETS}/11-refuse-to-be-average.png`,
];
const OUT = process.env.BRAND_STYLE_PATH || 'config/brand-style.grounding.txt';
const images = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_IMAGES;

console.log(`Grounding brand style from ${images.length} image(s) via fal (${process.env.GEMINI_VISION_MODEL || 'google/gemini-2.5-pro'})…`);
const desc = await describeBrandStyle({ imagePaths: images });
writeFileSync(OUT, desc + '\n');
console.log(`\n--- brand style grounding → ${OUT} ---\n${desc}\n`);
