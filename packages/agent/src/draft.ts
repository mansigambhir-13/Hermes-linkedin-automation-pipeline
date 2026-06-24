import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { loadBrandContext, assembleBrandContextBlock, findBannedPhrases } from '@rss/core';
import type { Platform, PostFormat } from '@rss/core';

/** Caption-gate output. caption_body is the BODY ONLY — no CTA, no hashtags (appended by code later). */
export const captionDraftSchema = z.object({
  caption_body: z.string(),
  hook: z.string(),
  visual_concept: z.string(),
  rationale: z.string(),
});
export type CaptionDraft = z.infer<typeof captionDraftSchema>;

let cachedSystem: string | null = null;
function systemPrompt(): string {
  if (cachedSystem) return cachedSystem;
  const ctx = loadBrandContext(); // docs 01/02/03 from the project root
  cachedSystem = [
    "You are Rehearsal's social content studio. You write LinkedIn and Instagram posts for Rehearsal (by Gradeless.ai), an AI interview-rehearsal platform for MBA aspirants, campus-placement candidates, and early-career professionals in India.",
    'Follow the Brand & Voice Spec below for EVERY word.',
    'OUTPUT THE CAPTION BODY ONLY — never write a CTA or hashtags; those are appended deterministically by code.',
    'ORIGINALITY (hard rule): originate a FRESH hook, angle, and story. The 22 briefs and example lines are voice/territory calibration, NOT content to reproduce — never paraphrase a brief into a post unless explicitly asked.',
    'THE BAR: ready when it would make a smart, skeptical MBA student stop scrolling, feel slightly called out, and think "what does Rehearsal actually see that I don\'t." Generic edtech marketing is a failure.',
    '',
    assembleBrandContextBlock(ctx),
  ].join('\n');
  return cachedSystem;
}

/** Light JSON repair for small-model output: strip trailing commas before } or ]. */
function repairJson(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

/** Tolerant JSON extraction — strips markdown fences and grabs the outermost object (smaller models add prose/fences). */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object found in model response');
  return JSON.parse(repairJson(cleaned.slice(start, end + 1)));
}

/** Same tolerance, but for a top-level JSON array (the slide list). */
function extractJsonArray(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON array found in model response');
  return JSON.parse(repairJson(cleaned.slice(start, end + 1)));
}

/**
 * Generate text then parse JSON, retrying a few times — a model can occasionally emit invalid JSON
 * (an unescaped quote/newline inside a value). A retry usually fixes it; we surface the last error only
 * if every attempt fails.
 */
async function generateParsed<T>(model: string, system: string, prompt: string, parse: (t: string) => T, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { text } = await generateText({ model: anthropic(model), system, prompt });
    try {
      return parse(text);
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`model did not return valid JSON after ${attempts} attempts: ${last instanceof Error ? last.message : String(last)}`);
}

/** Tell the model to keep its JSON valid — the single biggest cause of parse failures on the 20B. */
const STRICT_JSON =
  'Output STRICT valid JSON only — inside any string value, write a literal double-quote as \\" and a line break as \\n; never leave a raw quote or newline unescaped.';

/** One carousel slide: a short headline + a RICH editorial visual concept (Directive 04, Upgrade A). */
export const slideSpecSchema = z.object({ headline: z.string(), concept: z.string() });
export const slideListSchema = z.array(slideSpecSchema).min(2);
export type SlideSpec = z.infer<typeof slideSpecSchema>;

export interface SlideInput {
  idea: string;
  hook: string;
  body: string;
  visualConcept: string;
  platform: Platform;
  n: number; // desired slide count
}

/**
 * The `build_image_prompts` step (Directive 04, Upgrade A): turn an approved caption into N carousel slides,
 * each a SHORT headline + a complete editorial scene description. Slide 1 is the cover (the hook). Runs on the
 * same Anthropic model with generateText + tolerant parse.
 */
export async function draftSlides(input: SlideInput, model: string): Promise<SlideSpec[]> {
  const prompt =
    `Approved caption to adapt into a ${input.n}-slide ${input.platform} carousel:\n` +
    `Topic: ${input.idea}\nHook: ${input.hook}\nSeed visual metaphor: ${input.visualConcept}\n\nBody:\n${input.body}\n\n` +
    `Produce exactly ${input.n} slides that tell this story in sequence. Slide 1 is the cover built from the hook.\n` +
    `Each slide needs:\n` +
    `- "headline": a punchy on-slide line, max ~8 words (this WILL be typeset into the image — keep it clean).\n` +
    `- "concept": a RICH editorial scene — concrete subject + composition + lighting + mood + a metaphor tied to interviews/careers/CV/placements. One focal idea. No literal stock; conceptual illustration.\n` +
    `Keep one consistent visual world across all slides (same register, recurring motif).\n\n` +
    `Respond with ONLY a JSON array — no prose, no fences:\n` +
    `[{"headline":"<slide line>","concept":"<rich scene>"}, ...] (exactly ${input.n} items).\n` +
    STRICT_JSON;
  return generateParsed(model, systemPrompt(), prompt, (t) => slideListSchema.parse(extractJsonArray(t)));
}

export interface DraftInput {
  idea: string;
  platform: Platform;
  format: PostFormat;
  instruction?: string; // optional refine instruction from the reviewer ("punchier", "lead with the CV angle")
}

/**
 * Captions run on Anthropic (Claude) via the AI SDK — gpt-oss/Bedrock is fully retired. We use generateText +
 * a strict JSON instruction + tolerant parse (robust regardless of provider). `model` is an Anthropic model
 * id (e.g. claude-sonnet-4-6), defaulted from ANTHROPIC_MODEL by the caller.
 */
export async function draftCaption(input: DraftInput, model: string): Promise<CaptionDraft & { banned: string[] }> {
  // Structural per-platform shaping (length/format) — the brand VOICE comes from the spec docs, this just fits the channel.
  const platformGuide =
    input.platform === 'instagram'
      ? 'Instagram shaping: front-load the hook in the very first line; tight, punchy, scannable (~80-150 words); short lines; minimal filler.'
      : input.platform === 'x'
        ? 'X (Twitter) shaping: one sharp idea, very tight (aim under ~280 characters); a single strong line or two; no filler, no hashtags in the body.'
        : 'LinkedIn shaping: open with a strong one-line hook, then 2-4 short paragraphs separated by blank lines; professional but provocative (~150-250 words).';
  const prompt =
    `Idea: ${input.idea}\nPlatform: ${input.platform}\nFormat: ${input.format}\n\n` +
    (input.instruction ? `REVISION INSTRUCTION from the reviewer — apply it while keeping the brand voice: ${input.instruction}\n\n` : '') +
    `Write the post for this platform and format, in Rehearsal's voice. ${platformGuide}\n\n` +
    `Respond with ONLY a JSON object — no markdown, no code fences, no prose around it — with exactly these string fields:\n` +
    `{"caption_body": "<the platform-shaped body, NO CTA, NO hashtags>", "hook": "<the opening hook line>", "visual_concept": "<one metaphorical visual idea>", "rationale": "<1-2 lines on why this hook/angle>"}\n` +
    STRICT_JSON;
  const parsed = await generateParsed(model, systemPrompt(), prompt, (t) => captionDraftSchema.parse(extractJson(t)));
  const banned = findBannedPhrases(parsed.caption_body).map((b) => b.phrase);
  return { ...parsed, banned };
}
