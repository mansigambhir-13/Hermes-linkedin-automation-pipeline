/**
 * The concrete Rehearsal visual identity, injected into EVERY image prompt (the marktech technique:
 * brand DNA on every call). Source of truth: skills/rehearsal-content/references/brand-visual-identity.md
 * + brand-and-voice-spec §6 (corrected to the real brand on 2026-05-24).
 */
// NOTE: describe colours and type in WORDS, never as hex codes or the literal font name. Image models
// (recraft especially) will typeset stray "#0a0a0a"/"Raleway" tokens directly into the picture. The exact
// hex values live in config/styleSpec metadata; the prompt only ever sees prose.
export const BRAND_VISUAL_BLOCK = [
  'Rehearsal brand: a dark near-black charcoal canvas with crisp off-white text.',
  'A clean modern geometric sans; large confident headline; generous negative space.',
  'Signature accent: a vivid rainbow gradient sweeping violet to indigo-blue to coral-red to emerald-green, on ONE focal element only — never a full-bleed wash.',
  'Conceptual, metaphorical illustration; modern, a little cinematic; never literal stock photography or clip-art. One clear focal idea; uncluttered, premium, editorial.',
].join(' ');
