-- Rehearsal Social Studio — Phase 2: draft_records (the operational system of record).
-- The DraftStore (Slack bot + scheduling worker) reads/writes this. `record` holds the full draft + review
-- state as jsonb; status + scheduled_at_ms + approved_by are extracted for the worker's due-query. Idempotent.

create table if not exists draft_records (
  post_id         text primary key,
  record          jsonb not null,
  status          text not null,
  platform        text,
  scheduled_at_ms bigint,
  approved_by     text,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_draft_records_due
  on draft_records(status, scheduled_at_ms)
  where approved_by is not null;
