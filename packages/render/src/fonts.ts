import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Self-contained Raleway: the woff2 files in assets/fonts are inlined as base64 @font-face data URIs so a
 * render needs NO network (the production fix for postizz's webfont-over-the-wire weakness — Docker/worker-safe).
 *
 * Google serves Raleway v37 as a VARIABLE woff2 per subset (one file spans weights 200–900), so a single
 * @font-face per subset with `font-weight: 200 900` covers every weight the templates use.
 */
const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

// latin-ext first so latin (the more specific common range) wins on overlap.
const SUBSETS = [
  {
    file: 'raleway-latin-ext.woff2',
    range:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
  {
    file: 'raleway-latin.woff2',
    range:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
] as const;

let cached: string | null = null;

/** The @font-face CSS block (base64-embedded). Computed once, cached for the process. */
export function fontFaceCss(): string {
  if (cached) return cached;
  cached = SUBSETS.map(({ file, range }) => {
    const b64 = readFileSync(join(FONT_DIR, file)).toString('base64');
    return `@font-face{font-family:'Raleway';font-style:normal;font-weight:200 900;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`;
  }).join('\n');
  return cached;
}
