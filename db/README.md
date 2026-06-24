# Database migrations

`pnpm --filter @rss/core db:migrate` applies every `db/*.sql` (top level only, in filename order)
to `DATABASE_URL`. All live migrations are **idempotent** — re-running is a safe no-op.

## Live schema (auto-applied) — this is all the running system needs
| File | Table | Used by |
|---|---|---|
| `0002_draft_records.sql` | `draft_records` | the durable draft/review store, shared bot ↔ worker |
| `0003_library_posts.sql` | `library_posts` | the `/posts` content library |
| `0004_library_thread_media.sql` | (adds `thread`, `media_required` to `library_posts`) | X threads + media-required flag |

These three are **self-contained** (no foreign keys between them, no dependency on the legacy schema),
so a fresh Supabase project stands up cleanly with just `db:migrate`. They are also safe to apply to a
**shared** project — every statement is `create … if not exists` / `add column if not exists`.

## Legacy (`db/legacy/`, NOT auto-applied)
`legacy/0001_init.sql` is the original full design (`posts`, `post_images`, `idea_inbox`, `publish_log`,
`jobs`). It was **superseded** by the `draft_records` + `library_posts` model and is **not used** by the
deployed bot/worker (only the legacy `repo.ts` / non-deployed tool-server reference those tables).

It lives in `legacy/` because its `posts` table and the `post_images → posts(id)` foreign key **collide**
with the shared Supabase project's existing `posts` table (uuid vs bigint id) → "foreign key cannot be
implemented". Keeping it out of the default `db/` path means `db:migrate` no longer trips on it. Apply it
by hand only on a **dedicated** project that needs the full original schema.
