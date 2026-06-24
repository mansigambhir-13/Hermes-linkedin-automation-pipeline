# Rehearsal Social Studio — System Design (HLD + LLD)

> **ARCHITECTURE UPDATE (Change Directive 01 — Hermes as core / Option A):** Part A (HLD) below described a
> bespoke app+worker topology where our code owned the agent loop, Slack, and scheduling. Under Option A,
> those three are now **Hermes-native** (its gateway, agent loop, and cron). What remains OURS — and what
> the LLD in Part B still governs — is the **data model (§B1), the image engine (§B4), the publishing state
> machines (§B5), idempotency (§B5), and locked-config handling (§B11)**. These attach to Hermes as MCP
> tools. So: treat Part B's §B1, §B4, §B5, §B11 as still authoritative for the tool implementations;
> treat Part A's topology, the bespoke Slack design (§B7), the SQS-based agent/scheduler job design (§B6),
> and the agent tool-loop (§B3 reasoning tools) as SUPERSEDED by Hermes. CHANGE-DIRECTIVE-01 has the new
> topology and tool seam. The single consolidated, canonical plan is **`FINAL-BUILD-PLAN.md`** — read it first.

**Technical design for implementation. Companion to the Build Brief (doc 04).**
Stack is fixed: Supabase/Postgres · AWS · Slack · Hermes agent · pluggable image models · Claude API.
This document is the engineering blueprint Claude Code implements against. It does not contain application code; it specifies structure, contracts, schemas, state machines, and flows precisely enough to build without guessing.

---

# PART A — HIGH-LEVEL DESIGN (HLD)

## A1. System context

```
        ┌────────────┐        ┌────────────┐
        │  Marketer  │        │  Social    │
        │ (Web UI /  │        │  Manager   │
        │  Slack)    │        │  (Slack)   │
        └─────┬──────┘        └─────┬──────┘
              │                     │
              ▼                     ▼
        ┌──────────────────────────────────────┐
        │       REHEARSAL SOCIAL STUDIO          │
        │  (the system this document designs)    │
        └──────────────────────────────────────┘
              │            │            │
      ┌───────┘     ┌──────┘      ┌─────┘
      ▼             ▼             ▼
 ┌─────────┐  ┌───────────┐  ┌──────────────┐
 │ Claude  │  │  Image    │  │ LinkedIn API │
 │  API    │  │  model    │  │ + Instagram  │
 │ (agent, │  │  APIs     │  │  Graph API   │
 │  ideas) │  │ (pluggable)│ │              │
 └─────────┘  └───────────┘  └──────────────┘
```

External dependencies: Claude API (agent reasoning + auto-ideas), image-model APIs (per-job-type), LinkedIn API, Instagram Graph API, Slack API, Supabase (managed Postgres), AWS (compute, S3, Secrets, EventBridge).

## A2. Architectural style

- **Modular service backend** behind one API, decomposed into clear internal modules (not necessarily separate microservices in v1 — one deployable app with well-separated modules is simpler and meets the "smooth, no lag" bar).
- **Async-first for slow work.** Anything that calls an image model or a publish API runs as a background job. Request paths (UI submit, Slack action) return immediately and the result is delivered when ready (Slack message / DB status update).
- **One state layer (Supabase) as the source of truth.** Every surface reads/writes the same Postgres tables. No surface holds private state.
- **Pluggable adapters at every external edge** — image models, publishers, and the LLM are behind interfaces so vendors swap via config.

## A3. Logical components

| # | Component | Responsibility | Sync/Async |
|---|---|---|---|
| C1 | **API Gateway / App** | HTTP entry for Web UI + Slack events; auth; routing | Sync |
| C2 | **Intake Service** | Validates a request, creates a `posts` draft, enqueues a generation job | Sync (returns fast) |
| C3 | **Agent Runtime (Hermes)** | Orchestrates caption + image-prompt + generation + assemble + save | Async (job worker) |
| C4 | **Image Engine** | Pluggable per-job-type model routing; renders → S3 → refs | Async |
| C5 | **Slack Service** | Conversational threads, review messages (Block Kit), button actions, idea inbox | Sync events + async replies |
| C6 | **Review/Approval Service** | Applies approve / schedule / edit / regenerate to a post | Sync state change, async regen |
| C7 | **Publisher** | LinkedIn + Instagram adapters; the publish state machine | Async (job worker) |
| C8 | **Scheduler** | EventBridge cron → drains due posts; triggers auto-ideas | Async (cron) |
| C9 | **Idea Service** | Human-fed + Claude auto-ideas → `idea_inbox` | Async (cron) + sync |
| C10 | **State Layer** | Supabase/Postgres + S3 object storage | — |
| C11 | **Secrets/Config** | AWS Secrets Manager; vendor routing config | — |

## A4. Data flow (happy path, one post)

```
1. Intake (C2): UI form OR Slack chat → validate → INSERT posts(status=drafting)
                 → enqueue job{type: generate, post_id}
2. Agent (C3):  consumes job → draft caption(s) → build image_prompt(s)
                 → UPDATE posts(caption, visual_concept, rationale)
                 → enqueue job{type: render, post_id} per image
3. Image (C4):  consumes render jobs → route by job_type → model API
                 → upload S3 → INSERT post_images(status=rendered)
                 → when all images done → UPDATE posts(status=in_review)
4. Slack (C5):  on status=in_review → post review message (caption + previews + buttons)
5. Review (C6): human action:
                 - refine/edit → C3 revise (regenerate only changed parts) → re-render → update message
                 - approve_now → enqueue job{type: publish, post_id, platform}
                 - schedule → UPDATE posts(status=scheduled, publish_at)
6. Publisher(C7): consumes publish job → state machine per platform → external API
                 → INSERT publish_log → UPDATE posts(status=published|failed)
7. Scheduler(C8): cron every N min → SELECT posts WHERE status=scheduled AND publish_at<=now()
                 → enqueue publish jobs (idempotent)
```

## A5. Deployment topology (AWS)

```
Route53 / ALB
   │
   ▼
ECS Fargate service: "studio-app"  (C1,C2,C5,C6,C9 sync paths)
   │           │
   │           └── shares DB + queue with workers
   ▼
ECS Fargate service: "studio-worker" (C3,C4,C7 async jobs)
   ▲
   │ jobs
SQS queue(s)  ◄── EventBridge rules (C8 cron: scheduler + auto-ideas)

Supabase (managed Postgres)  ── source of truth
S3 bucket "rehearsal-social-media" ── images (presigned/public at publish)
AWS Secrets Manager ── all tokens/keys
CloudWatch ── logs/metrics; failures surfaced to Slack
```

- **Two Fargate services** (app + worker) sharing the DB and an **SQS** job queue. App stays responsive; workers do the slow model/publish calls.
- **SQS** is the job queue (simple, managed, dead-letter queue for failures). A lighter alternative is a DB-backed job table, but SQS + DLQ is the cleaner default on AWS.
- **EventBridge** scheduled rules trigger the scheduler drain and auto-idea cadence.
- **S3** stores images; objects are private, with presigned GET URLs minted on demand and **freshly at publish time** for Instagram's public-URL requirement.

## A6. Cross-cutting concerns

- **Latency budget:** sync paths < 300ms (just DB write + enqueue). All model/publish latency is absorbed by workers. UI/Slack always shows a "generating…" state.
- **Idempotency:** every job carries a unique key; publish jobs check `publish_log` for an existing `external_id` before calling the platform API (prevents double-post on retry).
- **Secrets:** never in repo; loaded from Secrets Manager at boot. Rotation-friendly.
- **Observability:** structured logs per job; every agent run and publish attempt logged; failures post into a Slack ops channel.
- **Security:** Slack request signature verification; OAuth tokens encrypted at rest; least-privilege IAM for S3/Secrets.

---

# PART B — LOW-LEVEL DESIGN (LLD)

## B1. Data model (Postgres DDL-level detail)

Enums (Postgres `CHECK` or native enums):
- `post_status`: drafting | generating | in_review | scheduled | publishing | published | failed
- `platform`: linkedin | instagram | both
- `post_format`: single_image | carousel
- `image_status`: queued | rendering | rendered | failed
- `image_job_type`: hero | statement | carousel_slide
- `idea_status`: proposed | drafted | dismissed
- `job_type`: generate | render | revise | publish | auto_ideas
- `publish_status`: pending | success | failed

```
posts (
  id            uuid pk default gen_random_uuid(),
  source        text not null,            -- ui | slack | auto_idea
  created_by    text not null,            -- user/slack id
  platform      text not null,            -- platform enum
  format        text not null,            -- post_format enum
  caption_body_linkedin   text,           -- EDITABLE BODY ONLY (no CTA/hashtags)
  caption_body_instagram  text,           -- EDITABLE BODY ONLY (no CTA/hashtags)
  hashtags_linkedin  text[],              -- locked set (separate column; composed in at render/publish)
  hashtags_instagram text[],              -- locked set (separate column; composed in at render/publish)
  visual_concept text,
  rationale      text,
  aspect_ratio   text,                    -- post-level locked ratio; uniform across all carousel slides
  status         text not null default 'drafting',  -- post_status
  publish_at     timestamptz,
  slack_channel  text,
  slack_ts       text,                    -- review message timestamp (for updates)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
)

post_images (
  id           uuid pk default gen_random_uuid(),
  post_id      uuid not null references posts(id) on delete cascade,
  slide_index  int not null default 0,    -- 0 for single image
  job_type     text not null,             -- image_job_type
  aspect_ratio text not null,             -- '1:1','4:5','9:16','1.91:1'
  s3_key       text,                      -- posts/{post_id}/{slide_index}.jpg
  alt_text     text,
  style_spec   jsonb,                     -- locked carousel spec (null for single)
  seed         text,
  model_used   text,                      -- which vendor/model rendered it
  status       text not null default 'queued',  -- image_status
  error        text,
  created_at   timestamptz not null default now(),
  unique (post_id, slide_index)
)

idea_inbox (
  id          uuid pk default gen_random_uuid(),
  idea        text not null,
  angle       text,
  source      text not null,              -- auto | human
  status      text not null default 'proposed',  -- idea_status
  created_post_id uuid references posts(id),
  created_at  timestamptz not null default now()
)

publish_log (
  id          uuid pk default gen_random_uuid(),
  post_id     uuid not null references posts(id),
  platform    text not null,              -- linkedin | instagram
  external_id text,                       -- platform post id (idempotency)
  status      text not null,              -- publish_status
  error       text,
  attempted_at timestamptz not null default now()
)

jobs (                                    -- only if using DB-backed queue; else SQS
  id          uuid pk default gen_random_uuid(),
  type        text not null,              -- job_type
  payload     jsonb not null,
  status      text not null default 'pending',
  idempotency_key text unique,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
)
```

**Caption composition (locked-config integrity).** `caption_body_linkedin`/`caption_body_instagram` hold the **editable body only.** The final published caption is composed deterministically at render/publish time as **body + locked CTA (from config, B11) + `hashtags_*` (columns)**. The edit path (B2 `/edit`) may write **only** the body, so a manager edit can never clobber the locked CTA/hashtags. Re-validate locked config on every edit and before publish.

Indexes: `posts(status)`, `posts(status, publish_at)` (scheduler drain), `post_images(post_id)`, `publish_log(post_id, platform, external_id)`, `idea_inbox(status)`.

## B2. Internal API contracts (the app's own HTTP/RPC surface)

REST-ish; all return JSON; auth via session (UI) or Slack signature (Slack).

```
POST /api/posts                      # intake from UI
  body: { platform, format, idea, prompt, created_by }
  → 202 { post_id, status: "drafting" }   # async; result lands in Slack

GET  /api/posts/:id                  # fetch a post + its images (presigned URLs)
  → 200 { post, images:[{slide_index, url, alt_text, status}] }

POST /api/posts/:id/revise           # apply feedback (UI or Slack)
  body: { feedback, scope: caption|image|all, slide_index? }
  → 202 { post_id, status: "generating" }

POST /api/posts/:id/approve          # publish now
  body: { platforms:["linkedin","instagram"] }
  → 202 { post_id, status: "publishing" }

POST /api/posts/:id/schedule
  body: { publish_at, platforms }
  → 200 { post_id, status: "scheduled", publish_at }

POST /api/posts/:id/edit             # manager edits caption BODY only (never CTA/hashtags)
  body: { caption_body_linkedin?, caption_body_instagram? }   # body text only; locked CTA/hashtags are composed in at render/publish and cannot be set here
  → 200 { post }

POST /api/slack/events               # Slack Events API (URL verification + messages)
POST /api/slack/interactions         # Slack Block Kit button/select actions
POST /api/slack/commands             # optional slash command entry

GET  /api/ideas                      # idea inbox
POST /api/ideas/:id/draft            # turn an idea into a post (→ POST /api/posts)
POST /api/ideas/:id/dismiss
```

All slow operations return `202` + a status; the client/Slack polls or waits for the async-delivered update.

## B3. Agent tool signatures (Hermes)

The agent runtime is invoked by the `generate`/`revise` job workers. Tools (capability contracts):

```
draft_caption(idea: str, platform: enum, format: enum, brand_context: ref)
    -> { caption_linkedin?: str, caption_instagram?: str, hook: str, rationale: str }

build_image_prompts(caption: str, visual_concept: str, format: enum, platform: enum)
    -> { prompts: [ {slide_index, job_type, prompt, aspect_ratio} ],
         style_spec?: object,   # present for carousel; identical across slides
         seed?: str }

generate_image(prompt: str, job_type: enum, aspect_ratio: str,
               style_spec?: object, seed?: str)
    -> { s3_key: str, model_used: str }          # generate + store ONLY, never publish

assemble_carousel(slide_prompts: list, style_spec: object, seed: str)
    -> { images: [ {slide_index, s3_key, model_used} ] }   # ordered, consistent set

revise(post: object, feedback: str, scope: enum, slide_index?: int)
    -> { updated_post: object, changed: ["caption"|"image:N"...] }
    # regenerates ONLY what changed (often a single slide) — cost + latency saver

save_draft(post: object) -> { post_id }
```

Hard contract: the agent has **no publish tool**. Publishing is exclusively the Publisher (C7), triggered by a human action.

Locked-config rule: `draft_caption` output never includes the CTA/hashtags. They are stored separately (CTA in config B11; `hashtags_*` columns) and composed into the final caption deterministically at render/publish (B1) — never by the model, and never settable via `/edit`. The agent cannot alter them.

Originality rule (system-prompt enforced): the agent treats all reference material (the 22 briefs, product copy, topic territory) as voice/territory calibration, **not** a content source — every caption and every auto-idea originates a fresh hook/angle/carousel concept (*fresh-by-default, brief-by-request*). Stated in the Hermes system prompt and verified in the Phase-1 caption gate (03-agent-instructions §5.7).

## B4. Image Engine — routing + adapter interface

```
interface ImageModelAdapter {
  generate(req: {
    prompt: str, aspect_ratio: str, style_spec?: object, seed?: str
  }) -> { bytes | url, model_name: str }
}

routing config (e.g. config/image_routing.json):
{
  "hero":           { "provider": "imagen4_ultra"  | "nano_banana_pro" },
  "statement":      { "provider": "ideogram_v3"    | "gpt_image_2" },
  "carousel_slide": { "provider": "recraft_v4"      }   // consistency specialist
}
```

- Router picks adapter by `job_type`. Adapters wrap each vendor SDK behind the single interface.
- **Carousel consistency:** the router pins one `style_spec` + one `seed` for the whole set and passes them to every `carousel_slide` call; a single `aspect_ratio` is fixed on the post (`posts.aspect_ratio`) and enforced across all slides at assembly. (See Image Generation Method doc §4.)
- Overlay-text cleaning: before a `statement` prompt is sent, strip any prompt-label leakage (e.g. "Headline:") so labels never render — port this helper from the marktech technique.
- Retries: exponential backoff on transient model errors; on final failure mark `post_images.status=failed`, surface to Slack.

## B5. Publishing — the state machine (per platform)

`posts.status` transitions: `in_review → publishing → (published | failed)`; scheduled posts go `scheduled → publishing → …`.

### LinkedIn — single image (ships first)
```
[start] → ensure OAuth token valid (refresh if needed)
       → register + upload single image asset
       → create post with media + composed caption
       → on success: publish_log(success, external_id); posts.status=published
       → on error:   publish_log(failed, error);        posts.status=failed → Slack
```

### LinkedIn — document / carousel (constrained API; verify the path; later milestone)
LinkedIn carousels are **document (PDF-style) posts** — a different, more constrained API surface than single-image UGC posts (initialize document upload → upload → reference by URN). Do not assume day-one one-click.
```
[start] → ensure OAuth token valid
       → initialize document upload → upload document asset → obtain document URN
       → create post referencing the document URN + composed caption
       → on success/error: same publish_log + status handling as single image
```
Verify this path during Phase 5 setup before promising LinkedIn carousel publishing.

### Instagram Graph API (two-step; the long pole)
```
PRECONDITIONS (must hold or fail fast with a clear message):
  - IG Professional account linked to FB Page
  - app has content-publishing permission (Meta app review PASSED)
  - every image reachable at a PUBLIC url (mint fresh presigned/public S3 url now)
  - all carousel slides share one aspect ratio (fixed on posts.aspect_ratio, enforced at assembly; re-assert here)
  - within 100-publishes-per-24h rate limit (check app-side counter)

SINGLE IMAGE:
  1. POST /{ig-user-id}/media        { image_url, caption }      -> creation_id
  2. poll  /{creation_id}?fields=status_code  until FINISHED
  3. POST /{ig-user-id}/media_publish { creation_id }            -> media_id (external_id)

CAROUSEL:
  1. for each slide: POST /{ig-user-id}/media { image_url, is_carousel_item:true } -> child_id
  2. POST /{ig-user-id}/media { media_type:CAROUSEL, children:[child_ids], caption } -> parent_id
  3. poll parent status until FINISHED
  4. POST /{ig-user-id}/media_publish { creation_id: parent_id } -> media_id

  on success: publish_log(success, media_id); posts.status=published
  on error:   publish_log(failed, error);     posts.status=failed → Slack
```

Idempotency: before step 1, check `publish_log` for an existing `success` row for (post_id, platform). If present, skip (prevents double-publish on cron retry).

## B6. Async job design

- **Queue:** SQS standard queue + DLQ. (Or `jobs` table if avoiding SQS.)
- **Job types:** `generate`, `render`, `revise`, `publish`, `auto_ideas`.
- **Worker loop:** long-poll SQS → dispatch by `type` → on success delete message; on failure (after N attempts) → DLQ + Slack ops alert.
- **Fan-out for carousels:** one `generate` job produces N `render` jobs (one per slide); a small completion check flips `posts.status=in_review` only when all slides are `rendered`.
- **Visibility timeout** sized above max model latency (e.g. 2–3 min) so jobs aren't redelivered mid-render.

## B7. Slack interaction design

- **Events API** (`/api/slack/events`): handles URL verification, thread messages (the conversational loop → routed to `revise` or a fresh `generate`).
- **Interactions** (`/api/slack/interactions`): Block Kit actions:
  - `approve_now` (multi-select platform) → `POST /approve`
  - `schedule` → opens a date/time modal → `POST /schedule`
  - `edit` → opens a caption modal → `POST /edit`
  - `regenerate` → `POST /revise` (scope chosen in a follow-up select: caption / image / all)
- **Review message:** Block Kit with caption text + image blocks (presigned URLs) + the action buttons. Store `slack_ts` so the same message is updated in place on revise/regenerate rather than reposted.
- **Idea inbox:** a periodic message listing `proposed` ideas with "Draft this" / "Dismiss" buttons.
- **Signature verification** on every inbound Slack request.

## B8. Scheduler & auto-ideas (EventBridge)

```
rule "publish-drain"  (every 5 min):
   SELECT posts WHERE status='scheduled' AND publish_at <= now()
   → enqueue publish job per platform (idempotent)
   → set status='publishing'

rule "auto-ideas" (team cadence, e.g. Tue+Fri 09:00 IST):
   enqueue job{type: auto_ideas}
   worker → Claude API with brand context (+ optional season/exam-calendar context)
         → INSERT idea_inbox(source='auto', status='proposed')
         → Slack idea-inbox message
```

## B9. Sequence diagrams (text)

**Generate (UI intake):**
```
UI → API: POST /api/posts
API → DB: INSERT posts(drafting)
API → SQS: job{generate, post_id}
API → UI: 202 {post_id}
Worker ← SQS: generate
Worker → Agent: draft_caption, build_image_prompts
Worker → DB: UPDATE posts(captions, concept)
Worker → SQS: render×N
Worker(render) → ImageEngine → S3; DB: INSERT post_images(rendered)
Worker → DB: UPDATE posts(in_review)  [when all slides rendered]
Worker → Slack: post review message (store slack_ts)
```

**Refine (Slack thread):**
```
Slack → API: /events (thread message "punchier hook")
API → SQS: job{revise, post_id, scope:caption}
Worker → Agent: revise(post, feedback, caption)
Worker → DB: UPDATE posts(caption)
Worker → Slack: update review message in place (slack_ts)
```

**Approve & publish (Instagram carousel):**
```
Slack → API: /interactions approve_now [instagram]
API → DB: UPDATE posts(publishing)
API → SQS: job{publish, post_id, instagram}
Worker → S3: mint public urls for all slides
Worker → IG: create child containers → carousel container → poll → media_publish
Worker → DB: publish_log(success, media_id); posts(published)
Worker → Slack: update message "✅ published"
```

## B10. Failure handling matrix

| Failure | Detection | Response |
|---|---|---|
| Image model error | adapter throws | retry w/ backoff; final → `post_images.failed` + Slack alert; offer regenerate |
| Partial carousel (some slides fail) | completion check | hold `posts` out of `in_review`; Slack alert with which slides failed; allow per-slide regen |
| LinkedIn/IG auth expired | API 401 | refresh token; if refresh fails → `failed` + Slack "re-auth needed" |
| IG public-URL not reachable | pre-publish check | fail fast before container create; clear message (S3/url issue) |
| Carousel slides not uniform aspect ratio | assembly + pre-publish precondition (posts.aspect_ratio) | enforced at assembly; on mismatch fail fast before container create |
| IG rate limit hit | app-side counter / API 4xx | defer publish, requeue with delay, notify Slack |
| Double-publish risk on retry | `publish_log` lookup | skip if success row exists |
| Job poison (repeated failure) | attempts > N | DLQ + Slack ops alert |

## B11. Configuration & secrets

- **Secrets Manager:** Claude API key, image-model keys, LinkedIn OAuth creds + tokens, Meta app creds + IG tokens, Slack bot token + signing secret, Supabase service key.
- **Config (repo, non-secret):** image routing map (B4), carousel default slide count, auto-idea cadence, locked CTA/hashtag sets (team-supplied), platform aspect-ratio map.
- **Locked config is data, not model output** — appended deterministically (B3).

## B12. Build sequencing note (maps to Build Brief §6)

The LLD is layered to match the phased build: B1–B3 (state + agent contracts) underpin Phase 1; B4 (image engine) is Phase 2 with the carousel-consistency gate; B7 (Slack) is Phase 3; intake UI is Phase 4; B5–B6 (publisher + jobs) Phase 5; B8 auto-ideas Phase 6. Instagram's preconditions in B5 are the long pole — the Meta app-review task (Operational Checklist) must be in flight from day one. Phase 0 also begins with **task 0.0** (verify the live gateway image roster, then author `image_routing.json` born-correct, Image Method §6) and two team-supplied prerequisites promoted from Build Brief §8: **locked CTA/hashtags** (blocks the Phase-1 caption gate) and **brand visual assets incl. 2–5 reference images** (anchors the Phase-2 consistency gate).

---

## Appendix — design decisions & rationale

- **One app + one worker, not microservices (v1):** fewer moving parts, meets the latency bar, easy to evolve into services later at the C-component seams.
- **SQS over DB-queue:** managed, DLQ for free, scales workers independently. DB-queue is the fallback if avoiding another AWS service.
- **Pluggable image routing per job-type:** the image landscape changes monthly; this isolates churn to config and is the single most important property of the image engine.
- **Async everywhere slow:** image gen + publishing never block a human-facing request → "smooth, no lag" as required.
- **Human-triggered publish only:** the agent has no publish capability by construction; publishing lives solely in C7 behind an explicit human action.
- **Update-in-place Slack messages:** the review message is a living object (keyed by `slack_ts`), so the refine loop feels conversational rather than spammy.
- **Caption = editable body + composed locked tail:** body stored separately from CTA/hashtags so a manager edit can never clobber the locked config; final caption composed at render/publish.
- **LinkedIn split (single-image vs document/carousel):** single-image ships first; the document-post path for carousels is verified in Phase 5, not assumed.
```
