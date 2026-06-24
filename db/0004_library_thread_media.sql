-- Per-platform format support: X threads (full multi-tweet) + media-required flag.
alter table library_posts add column if not exists thread         jsonb;   -- X thread: array of tweet strings (null = single post)
alter table library_posts add column if not exists media_required boolean not null default false; -- can't ship without an image
