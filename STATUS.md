# Status — Rehearsal Social Studio

_Last updated: 2026-06-03_

## 🚀 LIVE ON RENDER (2026-06-03)
Deployed from `mansigambhir-1313/rehearsal-social-studio` via `render.yaml` blueprint — two Background Workers (`rss-bot`, `rss-worker`), Singapore region, Starter plan. Both booted healthy (config-check all ✅, Socket Mode connected, worker polling 30s, ops channel `C0B5PKLL4UT`). Dev keys rotated; secrets set in the `rss-shared` env group. Local dev bot/worker stopped (cutover done) — Render is the sole live system. Backends: Supabase (`library_posts` + `draft_records`), Postiz (LinkedIn + X live; Instagram wired, awaiting image content), Supabase Storage (`post-media`), Anthropic.

**Acceptance tests to run in the first operating session** (`SLACK_OPS_CHANNEL` will alert on any failure): (1) live LinkedIn publish via `/posts`; (2) schedule +15 min → worker fires it; (3) restart `rss-worker` after → confirms no double-post (durable idempotency).

## What it is
An agent-driven social posting studio for **Rehearsal** (by Gradeless.ai). v1 flow = **distribution, not generation**: a human picks a pre-made post in Slack (`/posts`), reviews it, and publishes to LinkedIn / X via Postiz. Hermes (Claude) validates brand voice + platform fit and can adapt a post across platforms. A scheduling worker auto-publishes approved scheduled posts.

## What "Hermes" is (and isn't) in THIS version — read this
- **What it IS:** *decision-assist* on **exactly 3 touchpoints** — Re-evaluate (`validatePost`: brand-voice + platform-fit), Chat (`respondToMessage`: @mention/DM/threads), Adapt (`adaptCaption`: cross-platform rewrite on demand). Everything else is **deterministic plumbing** (the `/posts` picker is a DB query; approve/schedule/publish are gated Postiz calls; the worker is a pure scheduler with **no AI**). **A human commands every publish.** There is **no autonomous AI loop** — the only background automation is the deterministic scheduler firing posts a human already approved + scheduled.
- **What it is NOT:** autonomous origination. Hermes does not write posts, propose ideas, or publish on its own. The content is human-authored. (`/draft` AI generation exists but is **disabled in prod**.) This deliberately implements the standing rule "no auto-posting; human reviews and clicks."
- **v3 (committed, future):** Hermes-as-**draft-assist** — corpus + retrieval + few-shot first drafts that a human sharpens, then through the same review/approve/publish loop. A **deliberate** future project, gated on (1) sharing the exemplar folder and (2) the non-negotiable **gold-corpus separation** safeguard (approved-for-publish ≠ admitted-to-exemplars). See `docs/v3-plan.md`. The v1 deploy does not foreclose v3 — it gives v3 a working publishing system to plug into.

## Architecture
- **bot** (`apps/slack-bot`) — Slack Socket Mode: `/posts` picker, `/draft` generator, chat (DM/@mention/threads), review cards, publish. Web-intake + `/health` on `:3002`.
- **worker** (`apps/worker`) — publishes due scheduled posts.
- **Supabase** — `library_posts` (the content library) + `draft_records` (the durable draft/review store, shared bot↔worker).
- **Postiz** — publishing backend (LinkedIn + X connected). **Anthropic** — all LLM (captions, validation, chat, adaptation). **fal** — images (only for `/draft`).

## ✅ Verified against real services
- LinkedIn post published live; `/posts` picker loop end-to-end in Slack; Supabase content library (13 posts); platform-fit validation + cross-post adaptation; Anthropic LLM everywhere.
- Bugs caught by live tests & fixed: Postiz `image:[]` (text-only), X `who_can_reply_post`, cross-platform mis-post (platform-aware card).

## ✅ Production hardening (this pass)
- **Crash resilience** — process guards (no crash on stray errors), Bolt error handler, intake-server `EADDRINUSE`/error handling, graceful `SIGTERM`/`SIGINT` shutdown.
- **Fail-fast config** — `requireEnv` prints a present/missing report at boot and aborts if a required var is missing.
- **Durable draft store** — `DRAFT_STORE=supabase` (survives redeploys; shared bot↔worker). `draft_records` applied.
- **Durable idempotency** — successful publishes recorded on the draft record (per platform) → a re-click or restart cannot double-post.
- **Deploy artifacts** — `Dockerfile`, `Procfile`, `ecosystem.config.cjs` (pm2), `DEPLOY.md`; `--env-file-if-exists` start scripts (work with host-injected env).

## Platform scope (resolved 2026-06-01)
- **v1 publishes LinkedIn + X today.** Both connected in Postiz, both proven.
- **Instagram is connected** in Postiz (`instagram-standalone`, tryrehearsal.ai) and **fully wired** — but Instagram **mandates media**, and all 6 current library IG posts are **text-only**, so they cannot publish yet. The picker flags them (`⚠️ needs image to publish`) and the review card shows the IG publish button **only when the post has an image** (Schedule-only otherwise). No code change needed to publish IG — just give an IG post an image and it unlocks. (IG publish path is untested live until such a post exists.)

## ✅ Scheduling worker — proven (2026-06-01)
Scheduled a test post → worker's due-query picked it up → approval gate → published (stub) → status flipped `scheduled→published` → external id persisted on the record (durable idempotency). The unattended path works end to end.

## 🙋 Owner actions to go live (see DEPLOY.md §7-8)
1. **Pick a host** and run one bot + one worker under a supervisor.
2. **Rotate all keys** pasted during dev; inject via host env.
3. Set **`SLACK_APPROVERS`** + **`SLACK_OPS_CHANNEL`**.
4. (Optional) Connect **Instagram** in Postiz.
5. Define the **weekly content intake** (how finished posts land in `content/ready/` → `seed-library`, or written straight to `library_posts`).

## Key gotchas (learned the hard way)
- Supabase DB password with `#` must be URL-encoded (`%23`) in `DATABASE_URL`; pooler host is `aws-1-ap-northeast-1`.
- The Supabase project is **shared** — only `library_posts` + `draft_records` are ours; don't apply the `posts`/`post_images` migration.
- Postiz: `image` must always be an array; X requires `who_can_reply_post`.
