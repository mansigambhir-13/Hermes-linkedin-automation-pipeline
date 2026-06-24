/**
 * Banned / discouraged language from the Brand & Voice Spec (01 §4). Used as a lint signal in the
 * Phase-1 caption gate — a hard fail on banned phrases, a soft flag on hype heuristics.
 */
export const BANNED_PHRASES: readonly string[] = [
  'game-changer',
  'game changer',
  'unlock your potential',
  "in today's fast-paced world",
  'take it to the next level',
  'revolutionary',
  'seamless',
  'supercharge',
];

export interface BannedHit {
  phrase: string;
  index: number;
}

export function findBannedPhrases(text: string): BannedHit[] {
  const lower = text.toLowerCase();
  const hits: BannedHit[] = [];
  for (const phrase of BANNED_PHRASES) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(phrase, from);
      if (i === -1) break;
      hits.push({ phrase, index: i });
      from = i + phrase.length;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Soft heuristics for hype the spec discourages: exclamation stacks, emoji walls. */
export function findHypeSignals(text: string): string[] {
  const signals: string[] = [];
  if (/!{2,}/.test(text)) signals.push('exclamation-stack (e.g. "!!")');
  if (/(?:\p{Extended_Pictographic}\s*){3,}/u.test(text)) signals.push('emoji wall (3+ in a row)');
  return signals;
}
