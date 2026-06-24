/**
 * Seed INSTAGRAM versions of the glossary cards (additive, idempotent — upsert by `glossary-ig-<slug>`).
 *
 * Reuses the designed 4:5 renders already in Supabase Storage (same image_key as the LinkedIn rows — no
 * re-upload), and builds an IG-NATIVE tight caption via Hermes cross-post adaptation (adaptCaption):
 * caption-secondary, no clickable links ("Link in bio" instead), IG hashtag count. A deterministic guard
 * strips any URL line the model might keep (links are dead in IG captions). media_required=true (IG always).
 *
 * Run: pnpm --filter @rss/agent seed-glossary-ig   (needs DATABASE_URL + ANTHROPIC_API_KEY)
 */
import { getDb } from '@rss/core/db';
import { sanitizeCaption } from '@rss/core';
import { suggestHashtags } from '../src/decisions.js';

interface Row {
  id: string;
  title: string;
  caption: string;
  image_key: string | null;
  alt_text: string | null;
}

const sql = getDb();
const rows = (await sql`
  select id, title, caption, image_key, alt_text from library_posts
  where platform = 'linkedin' and id like 'glossary-%' order by id`) as unknown as Row[];
if (rows.length === 0) {
  console.log('No LinkedIn glossary rows found — run `pnpm --filter @rss/core seed-glossary` first.');
  process.exit(0);
}

/**
 * IG caption = the source's own opening paragraphs VERBATIM (human-written, zero drift) + the locked CTA
 * appended by code + smart hashtags via Anthropic. The only LLM involvement is hashtag selection — the
 * locked CTA can never drift ("Download Rehearsal"-style inventions) and no carousel-isms ("swipe") appear.
 */
const LOCKED_IG_CTA = 'Practice this in Rehearsal. Link in bio.';

function igBody(linkedinCaption: string): string {
  const paras = linkedinCaption
    .split(/\n{2,}/)
    .map((p) => p.trim())
    // stop-list: CTA lines, link lines, hashtag lines — the IG tail is rebuilt below
    .filter((p) => p && !/https?:\/\//i.test(p) && !/^#/.test(p) && !/rehearsal\.|link in bio|practice this in rehearsal|read more|find more/i.test(p));
  const out: string[] = [];
  for (const p of paras) {
    out.push(p);
    if (out.length >= 2 || out.join('\n\n').length > 240) break; // tight: caption-secondary per the brief
  }
  return out.join('\n\n');
}

let n = 0;
for (const r of rows) {
  const igId = r.id.replace(/^glossary-/, 'glossary-ig-');
  const body = igBody(r.caption);
  const tags = await suggestHashtags(body, 'instagram', 'Glossary'); // the one LLM step: contextual 5-8 tags
  const caption = sanitizeCaption(`${body}\n\n${LOCKED_IG_CTA}\n\n${tags.join(' ')}`);
  const title = r.title.replace(' · Glossary', ' · Glossary (IG)');
  await sql`
    insert into library_posts (id, title, platform, pillar, slot, caption, thread, media_required, image_key, alt_text)
    values (${igId}, ${title}, 'instagram', 'Glossary', null, ${caption}, null, true, ${r.image_key}, ${r.alt_text})
    on conflict (id) do update set
      title = excluded.title, caption = excluded.caption, media_required = excluded.media_required,
      image_key = excluded.image_key, alt_text = excluded.alt_text`;
  n++;
  console.log(`seeded ${igId} (instagram, ${caption.length} chars) +image(reused)`);
}
await sql.end();
console.log(`done — ${n} Instagram glossary cards seeded (images reused from storage).`);
