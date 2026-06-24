# Rehearsal Social Studio — FINAL BUILD PLAN (canonical)

**The single canonical plan — start here.** It merges **Change Directive 01** (Hermes as core / Option A) with the surviving constraints from the build package, so no one has to stitch the directive + doc 04 §6 by hand. Where this conflicts with doc 04 §2/§3/§6 or doc 06 Part A, **this document wins** (those are superseded). The source specs remain authoritative for their domains: **01** brand/voice, **02** image method, **03** agent behavior, **06 §B1/§B4/§B5/§B11** data model + tool LLD, **04 §1/§4/§5/§8** stack + publishing + team items.

---

## 1. Architecture — Hermes is the core

We build **ON** the NousResearch Hermes Agent platform (Python). Hermes natively owns the **agent loop, the Slack gateway, cron, and session memory**. Our domain logic attaches as an **MCP tool server + a Hermes skill**. Our Fastify app is *not* the front door; the bespoke Slack app, custom scheduler, and hand-rolled agent loop from the original design are **replaced by Hermes subsystems**.

```
Slack (marketer / social manager)
        │
        ▼
HERMES AGENT (Python)  ── native: Slack gateway · agent loop · cron · session memory (SQLite/FTS5)
  · skill:        rehearsal-content/   (brand voice · image method · originality · the bar)
  · context file: AGENTS.md            (always-on governance, incl. the system-of-record rule)
  · provider:     Anthropic via AI Gateway (one key)
        │  calls MCP tools
        ▼
RSS TOOL SERVER  (our code — TypeScript MCP server) ── side-effecting capabilities only
  compose_caption · generate_image · assemble_carousel ·
  save_draft / get_post / update_post_status · publish_* (approval-gated, idempotent)
        │
        ├── Supabase / Postgres   ← SYSTEM OF RECORD (all post + publish state)
        ├── AWS S3                ← images (public/presigned at publish time)
        └── Image / LinkedIn / Instagram APIs   (image models routed via AI Gateway)
```

## 2. What's ours vs Hermes-native

| Concern | Owner |
|---|---|
| Agent loop, drafting, conversational refine | **Hermes** (native) |
| Slack review/chat surface | **Hermes** gateway (not a bespoke Slack app) |
| Scheduling (auto-ideas, scheduled publish triggers) | **Hermes** cron |
| Session/conversation memory | **Hermes** SQLite/FTS5 |
| Brand voice / image method / originality | **our** `rehearsal-content` skill + `AGENTS.md` |
| Image generation, publishing, persistence | **our** RSS Tool Server (MCP tools) |
| Post + publish state, schedule, idea inbox | **Supabase** (system of record) |
| Images | **S3** |

## 3. The tool seam (RSS Tool Server — MCP)

Side-effecting capabilities only; all reasoning stays in Hermes.
- `compose_caption(body, platform)` → appends locked CTA + hashtags from config (model never emits them)
- `generate_image(prompt, job_type, aspect_ratio, style_spec?, seed?)` · `assemble_carousel(slide_prompts, style_spec, seed)` (uniform aspect ratio enforced)
- `save_draft(post)` · `get_post(post_id)` · `update_post_status(...)`
- `publish_linkedin_single` · `publish_linkedin_document` (carousel) · `publish_instagram` (2-step) — **approval-gated + idempotent**

## 4. Non-negotiables (enforced structurally, not just in prose)

- **Never publish without human approval** — the publish tools refuse unless `approved_by` + `post_id` are present. The agent has no unguarded publish path.
- **Locked config is data** — `compose_caption` appends the CTA/hashtags; the model writes `caption_body` only; `/edit` touches only the body.
- **Carousel consistency** — one locked `style_spec` + one `seed` across all slides; one uniform aspect ratio (`posts.aspect_ratio`).
- **Pluggable images** — `config/image_routing.json` + adapter interface; no vendor hardcoded.
- **Idempotent publishing** — check `publish_log` for a success row before any external call.
- **Originality** — fresh hook/angle/carousel by default; reference briefs are voice calibration, not a content menu; use a named brief's story only when a human asks (`rehearsal-content` skill).
- **GUARDRAIL — Supabase is the system of record.** Hermes' internal SQLite is for its **sessions and agent memory only.** All post/publish state (drafts, status, `publish_log`, idea inbox) lives in **Supabase**, written exclusively via the tools. **Never infer, reconstruct, or trust post/publish state from Hermes memory.**
- **GUARDRAIL — `HERMES_HOME` on persistent storage.** On AWS, `HERMES_HOME` (`~/.hermes` — skills, sessions, memory, config) **must** be mounted on a persistent volume (EFS, or EBS surviving task restarts). On ephemeral container storage the agent's memory + installed skill are wiped on every restart.

## 5. Stack (confirmed — do not re-decide)

Supabase/Postgres · AWS (Fargate, S3, Secrets Manager; persistent volume for `HERMES_HOME`) · Slack · **Hermes (Python) core** · **RSS Tool Server (TypeScript MCP — language decision confirmed)** · image + agent models via **AI Gateway** (one key; Hermes' Anthropic provider points at the gateway). Secrets in AWS Secrets Manager. Full detail: doc 04 §1.

## 6. Data model

Authoritative: **doc 06 §B1** (with corrections). `posts` (`caption_body_linkedin/instagram`, `hashtags_*`, `aspect_ratio`, `status`…), `post_images`, `idea_inbox`, `publish_log`, `jobs`. Migration: `db/0001_init.sql` (applied via the tool server; **pending a real `DATABASE_URL` to verify against a live DB**).

## 7. Publishing constraints

Authoritative: **doc 04 §5 + doc 06 §B5**. LinkedIn **single** (ships first) → LinkedIn **document/carousel** (constrained API — verify the document-post path) → **Instagram** 2-step (container→publish; carousel child→parent). IG needs public URLs at publish, ≤100 publishes/24h, and **Meta app review (~2–4 wks) — the critical path.** Idempotent via `publish_log`.

## 8. Phases (revised — supersedes doc 04 §6)

- **Phase 0 — DONE.** Foundation: `packages/core`, `db/0001_init.sql`, `config/*`, born-correct image routing. Typecheck + smoke green.
- **Phase H — Hermes core + `rehearsal-content` skill** *(absorbs old Phase 1 agent + Phase 3 Slack)*. Install Hermes; point its Anthropic provider at AI Gateway; `hermes gateway setup` → Slack test channel; install the skill + `AGENTS.md`; verify Hermes-specific skill/MCP/provider config against live docs first. **Acceptance:** Hermes drafts an in-voice Rehearsal post in Slack, no tools yet. ⛔ **Caption gate** (see §9).
- **Phase T — RSS Tool Server (MCP).** Scaffold the TS MCP server exposing `compose_caption`, `save_draft`, `get_post`, `update_post_status` over `packages/core` + Supabase; register with Hermes; add approval-gate + idempotency helpers. **Acceptance:** Hermes calls `compose_caption` (appends locked config) and `save_draft` persists a `posts` row.
- **Phase 2 — Image engine as tools.** `packages/image` + `generate_image`/`assemble_carousel` MCP tools. ⛔ **Carousel consistency gate** (see §9). Artifacts to an inspectable folder.
- **Phase 5 — Publishers as approval-gated tools.** LinkedIn single → document/carousel → IG 2-step; idempotent; **scheduling via Hermes cron.** IG activation gated on Meta review.
- **Phase 4 — Web UI: optional / deprioritized.** Slack-via-Hermes may be the only v1 surface.
- **Phase 6 — Auto-ideas via Hermes cron.** Scheduled job proposes ideas into Slack (propose-only; originality rule).

## 9. Quality gates (hard stops — do not build past)

- **Caption gate (Phase H — doc 01 §8):** ~15 real ideas drafted in-voice, saved to an inspectable folder, **human-judged**, incl. "fresh angle, not a rehash of a reference brief?" **Provisional until** real CTA/hashtags + the AI Gateway key land — a stubbed-CTA caption is not a pass.
- **Carousel consistency gate (Phase 2 — doc 02 §4):** ~15 real carousels; the consistency checklist passes **≥ ~70%** before any publishing is built on top.

## 10. Team-supplied blockers + critical path (see `BLOCKERS.md`)

1. **Meta app-review owner — name + start TODAY** (critical path, ~2–4 wks; gates IG publishing). 2. Locked **CTA** + 3. **hashtag** sets (gate Phase-H caption close). 4. **Brand assets** incl. 2–5 reference images (gate Phase-2 consistency). 5. **LinkedIn posting target**. 6. **Carousel default slide count**. 7. **Auto-idea cadence**. — **8. Image-model keys: RESOLVED** (one AI Gateway key; all 3 job types reachable).

## 11. Source documents

`directives/CHANGE-DIRECTIVE-01-hermes-core.md` (architecture rationale + tool seam) · `01`–`03` (content/behavior specs → realized as the `rehearsal-content` skill + `AGENTS.md`) · `06 §B1/§B4/§B5/§B11` (data model + tool LLD) · `04 §1/§4/§5/§8` (stack, data model, publishing, team items) · `05` (operational checklist + gates) · `BLOCKERS.md`.
