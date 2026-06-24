/**
 * Post text hygiene. The brand rule is: NO em dashes (—) or en dashes (–) in published copy —
 * they read as machine-generated and aren't the Rehearsal voice. We rewrite them to commas (the
 * usual editorial substitution for a parenthetical or appositive) and tidy the spacing/punctuation.
 *
 * This is enforced at publish time so no post can ship with a dash regardless of its source.
 */

/** True if the text contains an em dash or en dash. */
export function hasEmDash(text: string): boolean {
  return /[—–]/.test(text);
}

/**
 * Replace em/en dashes with commas and clean up the resulting punctuation/whitespace.
 * Examples:
 *   "the table — the salary — becomes"  → "the table, the salary, becomes"
 *   "Brief Roulette—the weekly drill"   → "Brief Roulette, the weekly drill"
 */
export function stripEmDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ') // em/en dash (any surrounding spacing) → comma + single space
    .replace(/\s+([,.;:!?])/g, '$1') // no space before punctuation
    .replace(/,\s*([,.;:])/g, '$1') // comma directly before other punctuation → keep the stronger mark
    .replace(/([.;:!?]),/g, '$1') // punctuation then stray comma → drop the comma
    .replace(/[ \t]{2,}/g, ' '); // collapse runs of spaces (keep newlines)
}

/** Caption sanitizer applied at publish time. Currently: strip em/en dashes. */
export function sanitizeCaption(text: string): string {
  return stripEmDashes(text);
}

/**
 * Flatten markdown emphasis to plain text for Slack chat replies — no asterisks/underscores for
 * bold/italic, markdown bullets become hyphens, heading markers dropped. (Slack uses single-* for
 * bold, but the brand preference here is plain prose with no stars at all.)
 */
export function toSlackPlain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1') // **bold**
    .replace(/__(.+?)__/gs, '$1') // __bold__
    .replace(/(^|[\s(])\*(\S[^*\n]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2') // *italic*
    .replace(/(^|[\s(])_(\S[^_\n]*?)_(?=[\s).,;:!?]|$)/g, '$1$2') // _italic_
    .replace(/^[ \t]*[*+][ \t]+/gm, '- ') // markdown "* " / "+ " bullets → "- "
    .replace(/^#{1,6}[ \t]+/gm, '') // drop "# " heading markers
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1'); // drop code-span backticks
}
