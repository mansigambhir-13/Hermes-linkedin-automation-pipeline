/**
 * Verify DATABASE_URL connectivity + list the public tables (so you can confirm migrations applied).
 * Run: pnpm --filter @rss/core db:check
 */
import { getDb } from '../src/db.js';

const sql = getDb();
const tables = await sql<{ tablename: string }[]>`
  select tablename from pg_tables where schemaname = 'public' order by tablename`;
console.log('✅ DB reachable. public tables:', tables.map((t) => t.tablename).join(', ') || '(none — run db:migrate)');
await sql.end();
