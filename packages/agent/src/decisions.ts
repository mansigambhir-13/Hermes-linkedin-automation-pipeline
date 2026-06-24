import { existsSync, readFileSync } from 'node:fs';
import { generateObject, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { loadBrandContext, sanitizeCaption } from '@rss/core';

/**
 * Anthropic-backed decision agent (no generation — judgment + chat only).
 *
 * Replaces the previous gpt-oss/Bedrock path for any decisioning. Two roles:
 *  - validatePost(post)        → structured verdict against the brand voice docs
 *  - respondToMessage(text)    → conversational reply (Slack DM / @mention)
 *
 * Brand context = `brand/brief.md` + `SOCIAL-POSTING-GUIDELINES.md` + `04-build-brief-for-claude-code.md`
 * (whichever exist). Loaded once, cached in-process.
 *
 * Requires `ANTHROPIC_API_KEY` in `.env`. Model = `claude-sonnet-4-6` by default; override via
 * `ANTHROPIC_MODEL` (e.g. `claude-opus-4-7` for higher-stakes review, `claude-haiku-4-5-20251001` for cheaper chat).
 */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

/** The platform grammar Hermes reasons from — shared by the validator and the chat agent. */
export const PLATFORM_GRAMMAR = [
  'PLATFORM GRAMMAR (what belongs where):',
  '- X (Twitter): one sharp idea or a thread; tight, aim under ~280 characters per post; conversational; at most ~2 hashtags; avoid link-walls.',
  '- LinkedIn: 150-600 words; a strong one-line hook then short structured paragraphs; professional but provocative; 3-5 hashtags; links are fine.',
  '- Instagram: visual-first and CAPTION-SECONDARY (per the brief, most readers never read the caption). The carousel/image carries the message. Keep the caption SHORT: a hook plus at most a line or two, then ONE approved CTA and the hashtags. The data point, the named phrase, the reveal/payload, and concrete examples live ON THE SLIDES, not the caption. NO clickable links in the caption ("Link in bio" is the accepted workaround).',
  'A long essay is wrong for X; a 3-line hook is thin for LinkedIn; a link in an IG caption is dead. A BIG, fully-evidenced Instagram caption is also wrong: on IG a tight caption is correct, because the carousel carries the depth. Do NOT treat an IG caption as incomplete for omitting the phrase/number/reveal that belongs on the slides.',
].join('\n');

/** Soft per-platform caption length ceilings (chars) used for a deterministic fit signal. */
const PLATFORM_CHAR_LIMIT: Record<string, number> = { x: 280, linkedin: 3000, instagram: 2200 };

/** Cheap, deterministic platform signals (no LLM) — grounds the model's platformFit and shows on the card. */
export function platformSignals(platform: string, caption: string): { charCount: number; limit: number; overLimit: boolean; hashtags: number; hasLink: boolean } {
  const limit = PLATFORM_CHAR_LIMIT[platform] ?? 3000;
  const hashtags = (caption.match(/#\w+/g) ?? []).length;
  const hasLink = /https?:\/\/\S+/i.test(caption);
  return { charCount: caption.length, limit, overLimit: caption.length > limit, hashtags, hasLink };
}

export const verdictSchema = z.object({
  decision: z.enum(['approve', 'hold', 'flag']),
  reasons: z.array(z.string()).min(1).max(5),
  voiceChecks: z.object({
    thirdPerson: z.boolean(),
    noExclamation: z.boolean(),
    noEmDashes: z.boolean(), // hard rule: no em/en dashes (—, –) in the copy
    noBannedPhrases: z.boolean(),
    specificNumbers: z.boolean(),
    noMotivationalCoaching: z.boolean(),
    noCompetitorDunking: z.boolean(),
  }),
  // Does the content fit the TARGET platform's grammar? (flag-only — never blocks publishing)
  platformFit: z.object({
    verdict: z.enum(['fits', 'marginal', 'mismatch']),
    reason: z.string(),
  }),
  suggestedEdits: z.array(z.string()).optional(),
});
export type Verdict = z.infer<typeof verdictSchema>;

export interface PostToValidate {
  platform: string;
  pillar?: string;
  caption: string;
  altText?: string;
  meta?: Record<string, string>;
}

let cachedBrand: string | null = null;
function brandContext(): string {
  if (cachedBrand) return cachedBrand;
  const blocks: string[] = [loadBrandContext().brief];
  // The build brief moved to doc-archives/ in the repo cleanup — it still carries brand context worth loading.
  for (const p of ['SOCIAL-POSTING-GUIDELINES.md', 'doc-archives/04-build-brief-for-claude-code.md', 'docs/platform-formats.md']) {
    if (existsSync(p)) blocks.push(`# ${p}\n\n${readFileSync(p, 'utf8')}`);
  }
  cachedBrand = blocks.join('\n\n---\n\n');
  return cachedBrand;
}

const VALIDATE_SYSTEM =
  'You are the brand-voice validator for Rehearsal social posts. Judge each post against the Rehearsal Social Media Production Brief + the social posting guidelines supplied in the user message. Be calibrated: approve clearly-on-brand posts; hold borderline ones for human eyes; flag clear violations of the writing rules (embrace), the refuse list, or the honesty guardrails. ' +
  'HARD PUNCTUATION RULE: posts must contain NO em dashes (—) or en dashes (–) — they read as machine-generated and are off-voice. Set voiceChecks.noEmDashes=false and lower the decision if any appear; the fix is to rewrite the dash as a comma, period, or restructured sentence. ' +
  'voiceChecks are concrete sub-checks. BE TERSE — this is a glanceable Slack verdict, not an essay. Each reason is ONE short sentence (aim under ~16 words) in the brand\'s clipped voice; give the FEWEST reasons that justify the decision (1-2 for approve, up to 3 for hold/flag); never write a paragraph or stack clauses. suggestedEdits is optional and at most one short line: only when a single-line rewrite fixes it. ' +
  'PLATFORM FIT: also judge whether the content fits the TARGET platform using the platform grammar provided. Set platformFit.verdict to fits | marginal | mismatch with a one-line reason (e.g. an essay pushed to X, a thin hook on LinkedIn, a link in an IG caption). Use the deterministic signals given. This is advisory (flag-only) — note it in reasons if it is a mismatch, but it does NOT by itself force a hold. ' +
  'INSTAGRAM EXCEPTION (important): an Instagram caption is a SHORT companion to the carousel — captions are secondary and the slides carry the data, the named phrase, and the reveal. Do NOT hold or flag an IG caption for being tight, for "withholding" the reveal, or for omitting the specific phrase/number/example that belongs on the slides — that is correct Instagram structure, not missing evidence. Apply the "numbers before adjectives / concrete examples" depth requirement to the CAROUSEL, not the caption. Judge IG captions only on hook, voice, the single approved CTA, and hashtags. A tight on-voice IG caption should APPROVE.';

export async function validatePost(post: PostToValidate): Promise<Verdict> {
  const meta = post.meta ? Object.entries(post.meta).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n' : '';
  const sig = platformSignals(post.platform, post.caption);
  const signalLine = `Deterministic signals — chars ${sig.charCount}/${sig.limit}${sig.overLimit ? ' (OVER LIMIT)' : ''}, hashtags ${sig.hashtags}, hasLink ${sig.hasLink}.`;
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: verdictSchema,
    system: VALIDATE_SYSTEM,
    prompt:
      `# Brand voice (authoritative)\n\n${brandContext()}\n\n---\n\n${PLATFORM_GRAMMAR}\n\n` +
      `---\n\n# Post to validate\n\nPlatform (target): ${post.platform}\nPillar: ${post.pillar ?? '(none)'}\n${signalLine}\n${meta}` +
      `\nCaption:\n${post.caption}\n` +
      (post.altText ? `\nAlt text:\n${post.altText}\n` : '') +
      `\nProduce a verdict.`,
  });
  return object;
}

const CHAT_SYSTEM =
  'You are the Rehearsal social-media-pipeline assistant. You help the social manager review posts, plan schedules, and answer brand-voice questions. You answer concisely in the Rehearsal calm-authoritative documentary observer voice — third-person, evidence-first, no exclamation, no motivational coaching, no hype. You NEVER write a post for them; that is human work. You CAN summarize the queue, suggest schedule slots, validate a draft, explain a brand rule, advise which platform a piece of content fits (X vs LinkedIn vs Instagram, per the platform grammar), or answer factual questions about queued posts. Keep replies under 4 short sentences unless the user asks for a longer answer. FORMAT: reply in plain text for Slack — no markdown, no asterisks or underscores for bold/italic, no "#" headings. If you list items, use simple hyphen bullets.';

export interface ChatContext {
  /** A one-paragraph summary of the current draft queue (status/scheduling), if available. */
  queueSummary?: string;
  /** The Slack user id, for personalised addressing in the prompt. */
  userId?: string;
}

export async function respondToMessage(message: string, context: ChatContext = {}): Promise<string> {
  const { text } = await generateText({
    model: anthropic(MODEL),
    system: CHAT_SYSTEM,
    prompt:
      `# Brand voice (authoritative)\n\n${brandContext()}\n\n---\n\n${PLATFORM_GRAMMAR}\n\n` +
      (context.queueSummary ? `---\n\n# Current queue\n\n${context.queueSummary}\n\n` : '') +
      `---\n\n# Message from <@${context.userId ?? 'user'}>\n\n${message}\n\nReply.`,
  });
  return text;
}

const ADAPT_SYSTEM =
  'You adapt an existing Rehearsal social post from one platform to another. PRESERVE the core idea, the facts, every specific number, and the brand voice (calm-authoritative documentary observer; third-person; no exclamation; no motivational coaching; NO em dashes — use commas/periods). RESHAPE only the length and structure to fit the target platform grammar provided. Keep the locked CTA and hashtags if present, adjusting hashtag count to the target norm. Output ONLY the adapted post body — no preamble, no quotes, no notes.';

/** Rewrite a post for a different platform (cross-post adaptation) — reshapes, never copies. */
export async function adaptCaption(caption: string, fromPlatform: string, toPlatform: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(MODEL),
    system: ADAPT_SYSTEM,
    prompt:
      `${PLATFORM_GRAMMAR}\n\n---\n\nAdapt this ${fromPlatform} post for ${toPlatform}. ` +
      `Fit ${toPlatform}'s grammar (e.g. X = tight, under ~280 chars; LinkedIn = a hook + a few short paragraphs).\n\n` +
      `Source (${fromPlatform}) post:\n${caption}\n\nAdapted (${toPlatform}) post:`,
  });
  return text.trim();
}

/**
 * The marker Hermes inserts when an evidence line needs a real figure that the source does NOT contain.
 * It NEVER fabricates a number — it leaves this slot for a human to fill (or cut). Publish is blocked while
 * one remains (see hasUnfilledDataSlot). Example: `[[DATA: graded N 'Why MBA' answers; X% collapsed]]`.
 */
const UNFILLED_DATA_SLOT_RE = /\[\[\s*DATA\b/i;

/** True if a caption still carries an unfilled real-data slot — used by the publish guards (bot + worker). */
export function hasUnfilledDataSlot(text: string): boolean {
  return UNFILLED_DATA_SLOT_RE.test(text);
}

const REFINE_SYSTEM =
  'You refine an existing Rehearsal social post so it is platform-ideal and passes the brand pillar checklist, WITHOUT changing its core idea or its facts. ' +
  'Treat the Rehearsal Social Media Production Brief supplied in the user message as the authoritative rules. Apply ALL of:\n' +
  '1) VOICE — calm-authoritative documentary observer; third person; OBSERVE the pattern, do NOT instruct, coach, or tell the reader what to do. The ending must land by stating the pattern more sharply, NOT by prescribing what the reader should do (no "the work is to...", no "it comes from..."). No motivational lines; no exclamation marks; NO em dashes or en dashes (use commas, periods, or restructure).\n' +
  '2) CTA — end the post with the locked CTA exactly: "Practice this in Rehearsal." (with a period, never an exclamation).\n' +
  '3) HASHTAGS — choose SMART, CONTEXTUAL hashtags specific to THIS post topic from the brand approved + branded pools in the brief, and VARY them to the post (do NOT default to the same stock set every time). Counts: LinkedIn 3, Instagram 5 to 8, X at most 2. Mix reach tags + niche/audience tags + at most one branded tag (#DeepProbe, #ConceptBriefs, #RehearsalApp; use sparingly, do not burn). Remove generic filler like #CareerDevelopment, #BusinessSchool, #MBAAdmissions, #Motivation. Place at the very end.\n' +
  '4) NEVER FABRICATE (critical) — this brand is evidence-first and honesty-bound. PRESERVE every real number, percentage, dataset size, and quote already in the source EXACTLY. Do NOT invent ANY specifics that are not in the source: no numbers, percentages, counts, dates, quotes, AND no invented scenarios, anecdotes, named/numbered examples ("three candidates", "Candidate A/B/C", "last month"), events, names, or concrete situations. If the source is abstract, keep it abstract. If the post clearly needs a data anchor and the source has NO real figure, insert a slot of the EXACT form [[DATA: short description of the real figure to fill]] on its own line where the evidence belongs, and add nothing fabricated around it.\n' +
  '5) STRUCTURE — fit the target platform grammar (provided); keep the strong hook; reshape and tighten the EXISTING material, do not pad and do not add new content.\n' +
  'Output ONLY the finished post body including the CTA and hashtags. No preamble, no commentary, no markdown headings.';

/**
 * Refine an existing (human- or Hermes-authored) post into a brand-ideal, platform-ideal version.
 * Same-platform polish (unlike adaptCaption). Grounded on the authoritative brand context. NEVER fabricates
 * data — missing evidence becomes a [[DATA: …]] slot a human fills. Output is em-dash-sanitized deterministically.
 */
export async function refineForBrand(caption: string, platform: string, pillar?: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(MODEL),
    system: REFINE_SYSTEM,
    prompt:
      `# Brand voice + pillar checklist (authoritative)\n\n${brandContext()}\n\n---\n\n${PLATFORM_GRAMMAR}\n\n---\n\n` +
      `Refine this ${platform} post${pillar ? ` (pillar: ${pillar})` : ''}. Keep the core idea and every real fact; fix voice, the locked CTA, hashtags, and the evidence anchor per the rules. ` +
      `Do NOT invent data — use a [[DATA: …]] slot if a real figure is missing.\n\nSource post:\n${caption}\n\nRefined post:`,
  });
  return sanitizeCaption(text.trim());
}

/** Per-platform hashtag count: how many to return (LinkedIn 3, Instagram up to 8, X at most 2). */
const HASHTAG_COUNT: Record<string, number> = { linkedin: 3, instagram: 8, x: 2 };

const HASHTAG_SYSTEM =
  'You select social hashtags for a Rehearsal post. Choose a SMART, CONTEXTUAL set that fits THIS post\'s specific topic and pillar, drawn from the brand approved + branded hashtag pools in the brief supplied. Rules: ' +
  'count by platform — LinkedIn 3, Instagram 5 to 8, X at most 2. Mix categories: high-volume reach tags + niche/audience tags + at most one branded tag (#DeepProbe, #ConceptBriefs, #RehearsalApp — use sparingly, do not burn them every post). ' +
  'VARY the set to the post topic; do NOT default to the same stock set every time. Prefer tags relevant to the post\'s actual subject. Stay on-brand: no generic filler like #CareerDevelopment, #Motivation, #Success, #BusinessSchool. ' +
  'Output ONLY the hashtags, space-separated, each starting with #. No other text.';

/**
 * Smart, non-repetitive hashtags for a post — Anthropic picks a contextual set from the brand pools, varied
 * to the topic (not the same stock tags every time), within the platform's count. Reusable standalone; the
 * refiner generates hashtags inline by the same rules.
 */
export async function suggestHashtags(content: string, platform: string, pillar?: string): Promise<string[]> {
  const { text } = await generateText({
    model: anthropic(MODEL),
    system: HASHTAG_SYSTEM,
    prompt:
      `# Brand hashtag pools + voice (authoritative)\n\n${brandContext()}\n\n---\n\n` +
      `Pick the hashtags for this ${platform} post${pillar ? ` (pillar: ${pillar})` : ''}. Make them specific to its topic and vary from the usual set.\n\nPost:\n${content}\n\nHashtags:`,
  });
  const tags = [...new Set(text.match(/#[A-Za-z0-9_]+/g) ?? [])]; // dedupe, keep order
  return tags.slice(0, HASHTAG_COUNT[platform] ?? 3);
}
