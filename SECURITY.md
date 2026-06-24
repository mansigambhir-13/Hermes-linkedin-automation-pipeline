# Security & deployment posture — Rehearsal Social Studio

The live system = two Render Background Workers (`rss-bot`, `rss-worker`) on Socket Mode, sharing one
Supabase project (Postgres + Storage), publishing via Postiz (LinkedIn + X + Instagram). All traffic is
outbound — no public ingress. Deploy steps live in [`RENDER.md`](RENDER.md); day-to-day ops in
[`OPERATING.md`](OPERATING.md).

## Secrets
- Real secrets live ONLY in Render's `rss-shared` env group as `sync: false` (Render prompts; never in the
  repo). Locally they live in `.env`, which is gitignored (`.env`, `.env.*`, except `.env.example`).
- [`.env.example`](.env.example) documents every variable with placeholder values — copy it to `.env`.
- **CI secret-scan** (`scripts/secret-scan.sh`, run on every push/PR) fails the build if `.env` is tracked
  or a high-signal secret pattern (Slack/AWS tokens, private keys, service-role JWTs) appears in a tracked
  file. Run it locally any time: `bash scripts/secret-scan.sh`.
- Rotation: the dev-pasted keys were rotated into the Render env group (owner, done).

## Access control — the one publish gate
- **`SLACK_APPROVERS`** (comma-separated Slack user IDs) is the allowlist for Approve / Schedule / Publish.
  **If it is unset, the allowlist defaults to everyone** — any channel member could publish to the live
  accounts. ⚠️ **Confirm it is set in Render** to the owner's id (+ any co-publishers).
- A human approves every publish; there is no autonomous posting. The scheduler only fires posts a human
  already approved + scheduled.

## Defense-in-depth on publishing (all enforced in code, bot + worker)
- **Approval gate** — `publishPost` refuses without an approver.
- **Idempotency** — durable `externalIds` per platform; re-click or restart can't double-post.
- **Content double-post guard** — the same library post won't publish twice to a platform.
- **Platform routing** — the card only shows the publish button for the post's own platform.
- **Media-required guard** — image-essential posts (all IG; transcript/quote/data cards) can't ship without an image.
- **Unfilled-data guard** — a refined post with a `[[DATA: …]]` slot is blocked until a human fills a real figure.
- **No fabrication** — the refiner never invents numbers, quotes, or scenarios; missing evidence → a data slot.
- **No em dashes** — sanitized deterministically on read + publish.

## Deployment safety
- **CI gate** (`.github/workflows/ci.yml`): typecheck + tests + secret-scan on every push to `main` and PR.
  This matters because Render `autoDeploy: true` ships every push straight to prod — CI is the gate.
- **Exactly ONE bot + ONE worker** (hard invariant). Two Socket-Mode bots on one app token = duplicate
  handling; two workers = double publishing. Never scale these horizontally.
- **Migrations** are idempotent and reproducible (`db/` live schema; see [`db/README.md`](db/README.md)).

## Data
- Supabase project is **shared** with another app (legacy `posts`/`topics`/etc. coexist). The live tables
  (`draft_records`, `library_posts`) are self-contained. Long-term: a dedicated project or `rss.` schema.
- The `post-media` storage bucket is **public-read by design** — Postiz and Slack fetch image URLs directly.
  Only non-sensitive post imagery goes there. Uploads require the service-role key.

## Owner checklist (the only items code can't do)
- [ ] **Confirm `SLACK_APPROVERS` is set** in the Render `rss-shared` env group (the real publish gate).
- [ ] Confirm exactly one `rss-bot` and one `rss-worker` instance (no scaling).
- [x] Rotate dev-exposed keys into Render (done).
- [ ] (When standing up a fresh environment) run `pnpm --filter @rss/core db:migrate` — applies the live
      schema cleanly; the legacy full schema in `db/legacy/` is only for a dedicated project.
