/**
 * Seed library_posts from the content folder. Idempotent (upsert by id).
 * Any local image is uploaded to the object store (Supabase Storage in prod) and the PORTABLE storage key
 * is what lands in image_key — never a local filesystem path (which wouldn't exist on Render).
 * Text-only posts upload nothing (so no storage credentials are needed to seed them).
 * Run: pnpm --filter @rss/core seed-library   (needs DATABASE_URL + `db:migrate` first)
 */
import { readFileSync } from 'node:fs';
import { FolderLibrary } from '../src/contentLibrary.js';
import { getDb } from '../src/db.js';
import { createObjectStore } from '../src/objectStore.js';

const posts = await new FolderLibrary().list();
if (posts.length === 0) {
  console.log('No posts found in the content folder — nothing to seed.');
  process.exit(0);
}
const store = createObjectStore();
const sql = getDb();
let uploaded = 0;
for (const p of posts) {
  let imageKey: string | null = p.imageKey ?? null;
  if (p.imagePath) {
    const key = `library/${p.id}.png`;
    await store.put(key, readFileSync(p.imagePath), 'image/png'); // → Supabase Storage; stores portable key
    imageKey = key;
    uploaded++;
  }
  await sql`
    insert into library_posts (id, title, platform, pillar, slot, caption, thread, media_required, image_key, alt_text)
    values (${p.id}, ${p.title}, ${p.platform}, ${p.pillar ?? null}, ${p.slot ?? null}, ${p.caption}, ${p.thread ? sql.json(p.thread) : null}, ${p.mediaRequired ?? false}, ${imageKey}, ${p.altText ?? null})
    on conflict (id) do update set
      title = excluded.title, platform = excluded.platform, pillar = excluded.pillar,
      slot = excluded.slot, caption = excluded.caption, thread = excluded.thread,
      media_required = excluded.media_required, image_key = excluded.image_key, alt_text = excluded.alt_text`;
  console.log(`seeded ${p.id} (${p.platform})${p.thread ? ` +thread(${p.thread.length})` : ''}${p.mediaRequired ? ' +media-req' : ''}${p.imagePath ? ' +image' : ''}`);
}
await sql.end();
console.log(`done — ${posts.length} posts seeded, ${uploaded} image(s) uploaded to object storage.`);
