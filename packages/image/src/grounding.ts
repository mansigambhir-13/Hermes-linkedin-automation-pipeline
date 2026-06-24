import { existsSync, readFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';

/**
 * Directive 04, Upgrade C — vision-grounding of the REAL brand references.
 * Per the owner's instruction, this runs entirely through fal (FAL_API_KEY): a Gemini vision model hosted on
 * fal (`fal-ai/any-llm/vision`) describes the brand's actual look, and that description is injected into every
 * image prompt as the "Reference style" line. No separate Gemini/Google API key.
 *
 * The description is computed ONCE by `scripts/ground-brand.ts` and cached to a file; generation just reads
 * the cache (no fal call per image).
 */
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'google/gemini-2.5-pro';
const BRAND_STYLE_PATH = process.env.BRAND_STYLE_PATH || 'config/brand-style.grounding.txt';

let configured = false;
function ensureFal(): void {
  if (configured) return;
  const key = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (!key) throw new Error('fal not configured: set FAL_API_KEY (Directive 02).');
  fal.config({ credentials: key });
  configured = true;
}

const SYS = "You are a senior art director reverse-engineering a brand's visual identity into a reusable style guide.";
const PER_IMAGE_PROMPT =
  'This is a real marketing/product visual from the brand "Rehearsal" (an AI interview-prep platform). ' +
  'In 2–3 sentences describe ONLY its visual STYLE as reusable AI-image-prompt guidance: the colour palette and ' +
  "exactly what element any gradient is applied to, the canvas/background, typography feel, composition and negative space, " +
  'level of abstraction, illustration-vs-photography, and mood. Do NOT transcribe any words/headlines or describe specific UI content.';
const synthPrompt = (descriptions: string[]): string =>
  'Below are style notes from several real visuals of the brand "Rehearsal". Synthesize ONE tight 4–6 sentence ' +
  'visual style guide capturing the SHARED, recurring style, written as direct instructions for an AI image generator ' +
  '(palette + exactly where the gradient goes, the dark canvas, typography feel, composition/negative space, level of ' +
  'abstraction, conceptual-illustration-not-photo, mood). Output only the paragraph — no preamble, no bullets.\n\n' +
  descriptions.map((d, i) => `(${i + 1}) ${d}`).join('\n\n');

export interface GroundOptions {
  imagePaths: string[];
  model?: string;
}

const out = (r: { data: unknown }): string => ((r.data as { output?: string }).output ?? '').trim();

/**
 * Upload each local brand ref to fal storage, describe it with a Gemini vision model (one image per request —
 * the endpoint caps at 1), then synthesize the notes into a single style guide via a Gemini text model. All
 * through fal (FAL_API_KEY). Falls back to joining the per-image notes if synthesis fails.
 */
export async function describeBrandStyle(opts: GroundOptions): Promise<string> {
  ensureFal();
  const model = opts.model || VISION_MODEL;
  const notes: string[] = [];
  for (const p of opts.imagePaths) {
    const url = await fal.storage.upload(new Blob([readFileSync(p)], { type: 'image/png' }));
    const res = await fal.subscribe('fal-ai/any-llm/vision', {
      input: { model, image_urls: [url], system_prompt: SYS, prompt: PER_IMAGE_PROMPT },
    });
    const note = out(res);
    if (note) notes.push(note);
  }
  if (!notes.length) throw new Error('fal vision returned no descriptions for any brand image');

  try {
    const synthModel = process.env.GEMINI_TEXT_MODEL || 'google/gemini-2.5-flash';
    const res = await fal.subscribe('fal-ai/any-llm', {
      input: { model: synthModel, system_prompt: SYS, prompt: synthPrompt(notes) },
    });
    const synth = out(res);
    if (synth) return synth;
  } catch {
    /* fall through to the joined notes */
  }
  return notes.join(' ');
}

/** The cached brand-style description injected into every image prompt (Upgrade C). Undefined until grounded. */
export function loadBrandStyleGrounding(path: string = BRAND_STYLE_PATH): string | undefined {
  if (!existsSync(path)) return undefined;
  const txt = readFileSync(path, 'utf8').trim();
  return txt.length ? txt : undefined;
}
