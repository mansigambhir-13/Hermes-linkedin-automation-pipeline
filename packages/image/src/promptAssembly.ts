import type { AspectRatio, ImageJobType } from '@rss/core';
import { BRAND_VISUAL_BLOCK } from './brand.js';

const LABEL_LEAK = /^\s*(headline|sub|subhead|caption|text|title)\s*:\s*/i;

/** Strip prompt-label leakage so labels never render in the image (Directive 04 / marktech _clean_overlay_text). */
export function cleanOverlayText(text: string): string {
  return text.replace(LABEL_LEAK, '').trim();
}

/**
 * Two distinct modes (Directive 04, Upgrade D):
 *  - editorial: pure concept image, ALL text forbidden.
 *  - poster:    text IS the focal point; the approved line(s) are typeset in, under COPY SAFETY RULES.
 * 'statement' jobs are always posters; any job carrying headline text is treated as a poster; else editorial.
 */
export type ImageMode = 'editorial' | 'poster';
export function modeFor(jobType: ImageJobType, headlineText?: string): ImageMode {
  if (jobType === 'statement') return 'poster';
  return headlineText ? 'poster' : 'editorial';
}

export interface AssembleOptions {
  jobType: ImageJobType;
  concept: string; // Upgrade A: a RICH scene description — subject + setting + lighting + mood + concrete metaphor
  aspectRatio: AspectRatio;
  headlineText?: string; // poster: the exact headline to typeset in
  subText?: string; // poster: optional second line
  styleNote?: string; // carousel: the locked style spec, applied identically per slide
  slideContext?: string; // e.g. "Slide 2 of 5 in one cohesive set."
  referenceStyle?: string; // Upgrade C: Gemini vision-grounding of the real brand refs (blank until wired)
}

/**
 * Directive 04 (Upgrades A/B/D): a dense, labeled, multi-section prompt. Structure is what makes the model
 * follow the brand instead of inventing generic art. Upgrade C (the reference-style line) is injected when
 * `referenceStyle` is supplied; until GEMINI_API_KEY is wired it is simply omitted.
 */
export function assembleImagePrompt(opts: AssembleOptions): string {
  const mode = modeFor(opts.jobType, opts.headlineText);
  const out: string[] = [];

  out.push(
    mode === 'poster'
      ? 'A premium designed social poster for "Rehearsal" (AI interview-prep platform).'
      : 'A high-fidelity editorial concept image for "Rehearsal" (AI interview-prep platform). No text.',
  );
  out.push('');

  // Poster copy + COPY SAFETY RULES first, so the model treats text as the primary job.
  if (mode === 'poster' && opts.headlineText) {
    const head = cleanOverlayText(opts.headlineText);
    const sub = opts.subText ? cleanOverlayText(opts.subText) : undefined;
    out.push(
      sub
        ? `The finished poster must contain exactly two visible lines of copy:\n- Headline: "${head}"\n- Sub: "${sub}"`
        : `The finished poster must contain exactly one visible line of copy:\n- Headline: "${head}"`,
    );
    out.push(
      'COPY SAFETY RULES: render exactly the line(s) above and no other visible words; invent no filler, ' +
        'placeholder, camera labels, or prompt fragments; it must look like a finished designer ad, not a mockup.',
    );
    out.push('');
  }

  // VISUAL SUBJECT — the rich concept (Upgrade A), labeled (Upgrade B).
  out.push(mode === 'poster' ? 'VISUAL SUBJECT (background, subordinate to the text):' : 'VISUAL SUBJECT (high priority):');
  out.push(opts.concept);
  out.push('');

  // BRAND VISUAL DNA — brand on every call (the marktech technique).
  out.push('BRAND VISUAL DNA:');
  out.push(`- ${BRAND_VISUAL_BLOCK}`);
  out.push('- Audience/tone: MBA aspirants & campus-placement candidates in India; sharp, editorial, provocative.');
  if (opts.referenceStyle) out.push(`- Reference style: ${opts.referenceStyle}`);
  if (opts.styleNote) out.push(`- Locked style (identical across the set): ${opts.styleNote}`);
  if (opts.slideContext) out.push(`- ${opts.slideContext}`);
  out.push('');

  // CRITICAL REQUISITE — per mode (Upgrade D).
  out.push('CRITICAL REQUISITE:');
  out.push(
    mode === 'poster'
      ? 'an advertisement poster where the headline is the focal point — large, high-contrast, perfectly legible, ' +
          `professionally typeset in a Raleway-style sans. No logos, badges, or borders. Aspect ratio ${opts.aspectRatio}. 8K, zero AI artifacts.`
      : 'a pure concept image — absolutely NO text, logos, badges, borders, or frames. ' +
          `Aspect ratio ${opts.aspectRatio}. 8K editorial illustration quality, zero AI artifacts.`,
  );
  return out.join('\n');
}
