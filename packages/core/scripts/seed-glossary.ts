/**
 * Seed the GLOSSARY card set into library_posts (additive — leaves the existing calendar posts intact).
 *
 * These are finished, on-brand designed cards the team supplied in `Sample content/` (+ switching-cost at root):
 * each has a `## Suggested caption` (CTA + hashtags already inside) and a rendered PNG. Unlike the calendar
 * posts, every one ships WITH its image, so we upload the PNG to object storage and set media_required=true.
 *
 * Idempotent (upsert by id `glossary-<slug>`). Run: pnpm --filter @rss/core seed-glossary
 * Needs DATABASE_URL + SUPABASE_* (OBJECT_STORE=supabase) so the images can be uploaded.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getDb } from '../src/db.js';
import { createObjectStore } from '../src/objectStore.js';
import { sanitizeCaption } from '../src/text.js';

const FOLDER = 'Sample content '; // all glossary sources live here (switching-cost moved in during the repo cleanup)

interface Glossary {
  slug: string;
  title: string;
  caption: string;
  altText?: string;
  imagePath: string;
}

/** Body of a `## <heading>` section, until the next `##`. */
function section(md: string, heading: string): string | undefined {
  const m = new RegExp(`^##\\s+${heading}\\s*$`, 'im').exec(md);
  if (!m) return undefined;
  const rest = md.slice(m.index + m[0].length);
  const next = /^##\s+/m.exec(rest);
  return rest.slice(0, next ? next.index : undefined).trim();
}

const titleCase = (slug: string): string => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Resolve the rendered PNG for a slug — tolerates the `sunk-cost (1).png` download rename. */
function findImage(dir: string, slug: string): string | undefined {
  const candidates = [join(dir, `${slug}.png`), join(dir, `${slug} (1).png`)];
  return candidates.map((p) => resolve(p)).find((p) => existsSync(p));
}

function parse(dir: string, file: string): Glossary | undefined {
  const slug = file.replace(/\.md$/, '');
  const md = readFileSync(join(dir, file), 'utf8');
  const caption = section(md, 'Suggested caption');
  if (!caption) {
    console.log(`⏭️  ${slug}: no "## Suggested caption" — skipped`);
    return undefined;
  }
  const headline = /^-\s*\*\*Headline[^:]*:\*\*\s*(.+)$/im.exec(md)?.[1]?.trim();
  const subtitle = /^-\s*\*\*Subtitle[^:]*:\*\*\s*(.+)$/im.exec(md)?.[1]?.trim();
  const imagePath = findImage(dir, slug);
  if (!imagePath) {
    console.log(`⏭️  ${slug}: no rendered PNG found — skipped`);
    return undefined;
  }
  return {
    slug,
    title: headline ? `${headline} · Glossary` : titleCase(slug),
    caption: sanitizeCaption(caption),
    altText: subtitle ? sanitizeCaption(subtitle) : undefined,
    imagePath,
  };
}

const files = readdirSync(FOLDER).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
const items = files.map((f) => parse(FOLDER, f)).filter((x): x is Glossary => !!x);

if (items.length === 0) {
  console.log('No glossary cards found — nothing to seed.');
  process.exit(0);
}

const store = createObjectStore();
const sql = getDb();
let uploaded = 0;
for (const g of items) {
  const id = `glossary-${g.slug}`;
  const key = `library/${id}.png`;
  await store.put(key, readFileSync(g.imagePath), 'image/png');
  uploaded++;
  await sql`
    insert into library_posts (id, title, platform, pillar, slot, caption, thread, media_required, image_key, alt_text)
    values (${id}, ${g.title}, 'linkedin', 'Glossary', null, ${g.caption}, null, true, ${key}, ${g.altText ?? null})
    on conflict (id) do update set
      title = excluded.title, platform = excluded.platform, pillar = excluded.pillar,
      caption = excluded.caption, media_required = excluded.media_required,
      image_key = excluded.image_key, alt_text = excluded.alt_text`;
  console.log(`seeded ${id} (linkedin) +image  "${g.title}"`);
}
await sql.end();
console.log(`done — ${items.length} glossary cards seeded, ${uploaded} image(s) uploaded.`);
