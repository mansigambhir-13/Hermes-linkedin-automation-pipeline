-- Rehearsal Social Studio — initial schema (06-system-design §B1)
-- Apply to Supabase/Postgres. Idempotent (safe to re-run).
-- NOTE: application is pending a DATABASE_URL (Supabase project) — see BLOCKERS.md.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── enums ──
do $$ begin create type post_status   as enum ('drafting','generating','in_review','scheduled','publishing','published','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type platform      as enum ('linkedin','instagram','both'); exception when duplicate_object then null; end $$;
do $$ begin create type post_format   as enum ('single_image','carousel'); exception when duplicate_object then null; end $$;
do $$ begin create type image_status  as enum ('queued','rendering','rendered','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type image_job_type as enum ('hero','statement','carousel_slide'); exception when duplicate_object then null; end $$;
do $$ begin create type idea_status   as enum ('proposed','drafted','dismissed'); exception when duplicate_object then null; end $$;
do $$ begin create type job_type      as enum ('generate','render','revise','publish','auto_ideas'); exception when duplicate_object then null; end $$;
do $$ begin create type publish_status as enum ('pending','success','failed'); exception when duplicate_object then null; end $$;

-- ── posts: one row per post draft ──
create table if not exists posts (
  id                      uuid primary key default gen_random_uuid(),
  source                  text not null,                 -- ui | slack | auto_idea
  created_by              text not null,                 -- user / slack id
  platform                platform not null,
  format                  post_format not null,
  caption_body_linkedin   text,                          -- EDITABLE BODY ONLY (no CTA/hashtags)
  caption_body_instagram  text,                          -- EDITABLE BODY ONLY (no CTA/hashtags)
  hashtags_linkedin       text[],                        -- locked set; composed in at render/publish
  hashtags_instagram      text[],                        -- locked set; composed in at render/publish
  visual_concept          text,
  rationale               text,
  aspect_ratio            text,                          -- post-level locked ratio; uniform across carousel slides
  status                  post_status not null default 'drafting',
  publish_at              timestamptz,
  slack_channel           text,
  slack_ts                text,                          -- review message ts (update-in-place)
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── post_images: one row per generated image (N for a carousel) ──
create table if not exists post_images (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts(id) on delete cascade,
  slide_index  int not null default 0,                   -- 0 for single image
  job_type     image_job_type not null,
  aspect_ratio text not null,
  s3_key       text,                                     -- posts/{post_id}/{slide_index}.jpg
  alt_text     text,
  style_spec   jsonb,                                    -- locked carousel spec (null for single)
  seed         text,
  model_used   text,                                     -- vendor/model that rendered it
  status       image_status not null default 'queued',
  error        text,
  created_at   timestamptz not null default now(),
  unique (post_id, slide_index)
);

-- ── idea_inbox: auto-generated + human-saved ideas awaiting selection ──
create table if not exists idea_inbox (
  id              uuid primary key default gen_random_uuid(),
  idea            text not null,
  angle           text,
  source          text not null,                         -- auto | human
  status          idea_status not null default 'proposed',
  created_post_id uuid references posts(id),
  created_at      timestamptz not null default now()
);

-- ── publish_log: every publish attempt, per platform (idempotency) ──
create table if not exists publish_log (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts(id),
  platform     text not null,                            -- linkedin | instagram (no 'both')
  external_id  text,                                     -- platform post id
  status       publish_status not null,
  error        text,
  attempted_at timestamptz not null default now()
);

-- ── jobs: only used if running the DB-backed queue fallback instead of SQS (06 §A5/§B6) ──
create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  type            job_type not null,
  payload         jsonb not null,
  status          text not null default 'pending',
  idempotency_key text unique,
  attempts        int not null default 0,
  created_at      timestamptz not null default now()
);

-- ── indexes (06 §B1) ──
create index if not exists idx_posts_status            on posts(status);
create index if not exists idx_posts_status_publish_at on posts(status, publish_at);  -- scheduler drain
create index if not exists idx_post_images_post_id     on post_images(post_id);
create index if not exists idx_publish_log_lookup      on publish_log(post_id, platform, external_id);
create index if not exists idx_idea_inbox_status       on idea_inbox(status);

-- ── posts.updated_at trigger ──
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_posts_updated_at on posts;
create trigger trg_posts_updated_at before update on posts
  for each row execute function set_updated_at();
