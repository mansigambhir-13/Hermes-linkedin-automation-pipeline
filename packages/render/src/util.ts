/** Escape text destined for HTML so a quote/ampersand in copy can never break the markup or inject. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape HTML but keep <b>…</b> bold tags the caller intentionally inserted (for white-bolded names). */
export function escWithBold(s: string): string {
  return esc(s).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
}
