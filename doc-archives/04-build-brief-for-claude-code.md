# Rehearsal Social Studio — Build Brief for Claude Code

> **ARCHITECTURE UPDATE (Change Directive 01 — Hermes as core / Option A):** The component architecture and
> build order below are SUPERSEDED where they describe a bespoke agent loop, a hand-built Slack app, or a
> custom scheduler. We now build ON the NousResearch Hermes platform: Hermes owns the agent loop, the Slack
> gateway, cron, and memory; our image engine, publishers, data model, and brand/voice attach to it as
> MCP tools + a Hermes skill. The CONFIRMED STACK (§1), DATA MODEL (§4), PUBLISHING CONSTRAINTS (§5), and
> TEAM-SUPPLIED ITEMS (§8) below all still hold. For the revised architecture and phase plan, read
> CHANGE-DIRECTIVE-01 — it takes precedence over §2, §3, and §6 here. The single consolidated, canonical
> plan is **`FINAL-BUILD-PLAN.md`** — read it first.

**The handoff document. Architecture pinned to the real stack: Supabase/Postgres, AWS, Slack.**
Read this with the Brand & Voice Spec, the Image Generation Method, and the Agent Instructions. This brief closes the open decisions so Claude Code builds against reality, not guesses.

---

## 1. Confirmed stack (do not re-decide)

- **Database:** Supabase (Postgres). Use Supabase for data + auth if useful.
- **Hosting:** AWS.
- **Object storage:** AWS S3 (required — Instagram needs public/presigned URLs at publish time).
- **Review/chat surface:** Slack (workspace exists; a Slack app will be created).
- **Agent:** Hermes, loaded with the Brand & Voice Spec, Image Generation Method, and Agent Instructions as context.
- **Image models:** pluggable layer routing per job-type (Image Generation Method §2); start with the recommended models, keep vendor swappable via config.
- **Idea generation:** Claude via API for scheduled auto-ideas.

## 2. System components (what to build)

1. **Input surfaces**
   - **Web UI** — minimal form: prompt, idea, platform (LinkedIn/Instagram/both), format (single/carousel/let-agent-decide). Submit creates a draft and triggers the agent.
   - **Slack app** — conversational: a marketer/manager chats with the agent in a thread; the same thread is the refinement loop. Also hosts the review surface and the idea inbox.
2. **Agent runtime (Hermes)** — orchestrates draft → image prompts → generate → assemble → save (Agent Instructions §3). Exposed to both input surfaces.
3. **Image engine** — pluggable per-job-type model layer (Image Generation Method). Generates single images and consistent carousels; writes to S3; returns references.
4. **State layer (Supabase)** — drafts, images, schedule, idea inbox, publish status. Schema in §4.
5. **Review + publish surface (Slack)** — renders caption + image/carousel preview; buttons: approve & post now, schedule, edit, regenerate, plus free-text refine. Schema-driven.
6. **Publisher** — LinkedIn API (one-click) + Instagram Graph API (two-step container→publish). Scheduler cron drains due posts. See §5.
7. **Scheduler** — cron (e.g. EventBridge on AWS) that (a) drains due scheduled posts to the publisher, and (b) triggers auto-idea generation on a cadence.

## 3. The flow (one post's life)

```
intake (UI form OR Slack chat)
  → create draft row (status: drafting)
  → agent: caption + image_prompts (+ locked style spec if carousel)
  → image engine: generate → S3 → image refs
  → draft row updated (status: in_review) + images rows
  → Slack review message posted (caption + preview + buttons)
  → human: refine (loop) | edit | approve-now | schedule
      - refine → agent revise → regenerate changed parts → update message
      - approve-now → publisher fires → status: published
      - schedule → write publish_at → status: scheduled
  → (scheduled) cron drains due → publisher → status: published
```

## 4. Data model (Supabase / Postgres)

Tables to create. Types indicative; refine as needed.

- **`posts`** — one row per post draft.
  - `id uuid pk`, `created_by text`, `source text` (ui|slack|auto_idea),
  - `platform text` (linkedin|instagram|both), `format text` (single_image|carousel),
  - `caption_linkedin text`, `caption_instagram text`,
  - `visual_concept text`, `rationale text`,
  - `status text` (drafting|in_review|scheduled|published|failed),
  - `publish_at timestamptz null`, `created_at`, `updated_at`.
- **`post_images`** — one row per generated image (N for a carousel).
  - `id uuid pk`, `post_id uuid fk`, `slide_index int` (0 for single),
  - `s3_key text`, `aspect_ratio text`, `job_type text`, `alt_text text`,
  - `style_spec jsonb null` (the locked carousel spec), `seed text null`,
  - `status text` (rendering|rendered|failed), `created_at`.
- **`idea_inbox`** — auto-generated + human-saved ideas awaiting selection.
  - `id uuid pk`, `idea text`, `angle text`, `source text` (auto|human),
  - `status text` (proposed|drafted|dismissed), `created_at`.
- **`publish_log`** — every publish attempt, per platform.
  - `id uuid pk`, `post_id uuid fk`, `platform text`, `external_id text null`,
  - `status text` (success|failed), `error text null`, `attempted_at`.
- **`schedule`** — optional if not folding `publish_at` into `posts`; a calendar view of upcoming posts.

S3 layout suggestion: `posts/{post_id}/{slide_index}.jpg`. Store the `s3_key`, mint presigned/public URLs on demand (and freshly at publish time for Instagram).

## 5. Publishing — the honest constraints (plan around these)

### LinkedIn
- OAuth 2.0; post via the LinkedIn API with media. Confirm the org/page vs personal posting target and required scopes during setup.
- **Single image** — straightforward; one-click after approval is achievable early. **Ships first.**
- **Document / carousel** — LinkedIn carousels are *document (PDF-style) posts*: a more constrained API surface with an upload-then-reference flow. Do **not** assume day-one one-click — verify the document-post path during Phase 5 setup and treat it as a separate, later milestone from single-image publishing.

### Instagram (Graph API) — the long pole
- Requires: Instagram **Professional (Business/Creator)** account + linked Facebook Page + Meta developer app + the content-publishing permission.
- **Meta app review is required for production and typically takes ~2–4 weeks.** START THIS ON DAY ONE, in parallel with the build (see §6). This is the critical path.
- Publishing is **two-step**: POST a media container to `/{ig-user-id}/media`, then publish via `/{ig-user-id}/media_publish`. Carousels create child containers, then a parent carousel container, then publish.
- **Media must be at a public URL at publish time** — this is why S3 with public/presigned URLs is mandatory.
- Rate limit: 100 API-published posts per rolling 24h (a carousel counts as one). Current API version is in the v2x range (mid-2026) — target the latest stable.
- All carousel slides must share one aspect ratio.

### Scheduling
- `publish_at` on the post; an AWS EventBridge (or cron) job drains due posts and calls the publisher. Same publish path, time-gated. Enforce the IG rate limit app-side for scheduled bursts.

## 6. Build order (sequenced for risk + the long pole)

**Phase 0 — Foundations + start the long pole**
- **Task 0.0 (first) — Verify the image-routing roster.** Hit the live AI-Gateway Image-Gen filter, confirm which intended models (Image Generation Method §2) resolve, and author `config/image_routing.json` pinned to what is reachable — so the routing file is born correct. Recraft (`recraft/recraft-v4`) is confirmed; apply the §6 fallbacks for any that aren't.
- Load Brand & Voice Spec, Image Generation Method, Agent Instructions into the agent.
- **Kick off Meta app review paperwork now** (Business account, Page link, app, permission). Runs in background through all later phases. (Human task — see Operational Checklist.)
- Repo skeleton, Supabase schema (§4), S3 bucket with public/presigned URL support.
- **Hard prerequisite for Phase 1 — locked CTA + per-platform hashtag sets (team-supplied).** Promoted out of §8. The agent appends these deterministically and must not invent them (Agent Instructions §5.3). The append mechanism is built and unit-tested against a placeholder, **but the Phase-1 caption quality gate cannot close until the real strings are supplied** (a caption missing its real CTA isn't publishable). Flag like the Meta review.
- **Prerequisite for Phase 2 — brand visual assets (team-supplied): exact hex, the serif/sans fonts, and especially 2–5 reference images.** Promoted out of §8 / Operational Checklist; they anchor the carousel style spec + seed. Note: assets *raise the consistency floor; they do not retire the gate* — Phase 2's ≥70% checklist still runs and can still fail (→ tune style spec / switch routed model).

**Phase 1 — Agent brain (no publishing)**
- Hermes agent + `draft_caption`, `build_image_prompts`.
- Quality iteration: ~15 real ideas; tune until captions are on-brand and publishable with light edits (judged against the Brand & Voice Spec bar).

**Phase 2 — Image engine**
- Pluggable per-job-type layer; single image first, then carousels.
- **Hard gate:** carousel consistency checklist (Image Generation Method §4) passes ≥ ~70% on ~15 real runs before proceeding.

**Phase 3 — Slack (conversational + review)**
- Slack app: agent chat in threads, review message with all buttons, live refine loop, idea inbox.

**Phase 4 — Web UI**
- Minimal intake form → draft → routes to Slack review. (After Slack, since Slack is where work happens.)

**Phase 5 — Publisher**
- LinkedIn one-click (ships when ready).
- Instagram two-step path, activated when Meta review clears (lands around here thanks to the Phase 0 head start).
- Scheduler cron.

**Phase 6 — Auto-ideas**
- Scheduled Claude idea generation → idea inbox.

## 7. Non-functional requirements

- **Smooth, no lag:** image generation is the slow step (seconds per image; a carousel is N of them). Run generation **async** — intake returns immediately, the Slack review message arrives when rendering completes. Never block a UI request on image generation. Show a "generating…" state.
- **Regenerate cheaply:** on feedback, regenerate only what changed (often just one image), not the whole post.
- **Idempotent publishing:** guard against double-publish (e.g. a retried cron). Use `publish_log` + external_id checks.
- **Secrets:** model API keys, LinkedIn/Meta tokens, Slack signing secret — in AWS Secrets Manager, never in the repo.
- **Observability:** log every agent run and publish attempt; surface failures into Slack so a human sees them.

## 8. Open items for the team (not for Claude Code to guess)

1. **Locked config values** — the exact CTA style + per-platform hashtag sets the team wants appended. (Provide these; the agent must not invent them.) **→ Promoted to a Phase-0 hard prerequisite (§6): blocks closing the Phase-1 caption gate.**
2. **LinkedIn posting target** — company page vs personal/creator, and who authorizes OAuth.
3. **Meta app-review owner** — who has Business-account access to start the submission (critical path).
4. **Carousel default slide count** — a default (e.g. 4–6) or always the user's choice.
5. **Auto-idea cadence** — how often, and whether tied to placement-season timing.
6. **Image model API access** — which providers the team can get keys for (affects the default per-job routing). **→ Largely resolved by AI Gateway (one key); confirm the live roster in Phase-0 task 0.0. Only job-types that need a direct-provider adapter require a separate key.**

## 9. What was deliberately excluded

No marktech hotel architecture, no website scraper, no seasonal/footprint logic, no prior Hermes/Supabase/Slack design assumed as settled. Only the marktech *image-prompt technique* is reused, via the Image Generation Method. Nothing here depends on the earlier abandoned plan.
