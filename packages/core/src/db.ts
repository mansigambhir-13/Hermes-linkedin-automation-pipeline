import postgres from 'postgres';

/**
 * Supabase/Postgres client (lazy singleton). Requires DATABASE_URL.
 * `prepare: false` is friendlier with Supabase's transaction pooler.
 */
let sql: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Missing DATABASE_URL (Supabase/Postgres connection string).');
    sql = postgres(url, { prepare: false });
  }
  return sql;
}
