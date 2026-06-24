/**
 * Apply db/*.sql (in filename order) to DATABASE_URL. The SQL is idempotent, so re-running is safe.
 * Run from repo root: pnpm --filter @rss/core db:migrate  (the script cd's to root for the db/ path)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../src/db.js';

const dir = 'db';
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const sql = getDb();
for (const f of files) {
  process.stdout.write(`applying ${f} … `);
  await sql.unsafe(readFileSync(join(dir, f), 'utf8'));
  console.log('ok');
}
await sql.end();
console.log(`done — ${files.length} migration(s) applied.`);
