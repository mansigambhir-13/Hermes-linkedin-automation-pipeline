-- Content library: finished, pre-made posts the team feeds in (the picker source).
-- Hermes never authors these — it lists them, you pick one, it flows to review → publish.
create table if not exists library_posts (
  id          text primary key,
  title       text not null,
  platform    text not null default 'linkedin',   -- linkedin | x | instagram
  pillar      text,
  slot        text,                                -- human-readable scheduled slot from the source MD
  caption     text not null,                       -- ready-to-publish (CTA/hashtags already inside)
  image_key   text,                                -- storage key / local path / url for the image
  alt_text    text,
  created_at  timestamptz not null default now()
);
