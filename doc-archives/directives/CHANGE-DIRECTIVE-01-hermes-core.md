# CHANGE DIRECTIVE 01 — Adopt Hermes as the core (Option A)

**Read this before doing any further work. It changes the architecture. STOP the current Phase 1 plan.**
**Received 2026-05-24. Authoritative over old doc 04 §6 (build order), doc 06 §A (topology) / §B12.**

---

## 0. STOP

Do NOT build the Phase 1 agent brain as previously planned (a hand-rolled AI SDK tool-loop in
`packages/agent/hermes.ts`). That approach — call it "Option C" — was a TypeScript tool-loop merely
*named* Hermes. We are replacing it with the real thing.

If any Phase 1 agent-loop code exists, set it aside (do not delete the repo — Phase 0 stays). The agent
layer is being re-based onto a real platform.

## 1. What changed and why

"Hermes" in this project means a specific platform: **NousResearch Hermes Agent**
(https://github.com/nousresearch/hermes-agent, docs at https://hermes-agent.nousresearch.com/docs/).
It is the agent the product owner always intended to integrate. It is NOT a TypeScript library you
import — it is a **Python agent platform** that already provides, natively:

- a **messaging gateway with a Slack adapter** (our review + chat surface — do not hand-build one)
- a **cron subsystem** ("first-class agent tasks") (our scheduler + auto-ideas — do not hand-build one)
- **session storage + memory** (SQLite + FTS5, agent-curated memory) (cross-session recall of past posts/preferences)
- a **skills system** (procedural memory; agentskills.io-compatible) (where brand/voice/originality live)
- an **MCP client** and a **plugin system** for registering custom tools (how our image/publish/state logic attaches)
- multi-provider model support, including Anthropic

We are adopting **Option A: build ON Hermes as the core.** Hermes owns the agent loop, Slack, cron, and
memory. Our custom logic (image generation, publishing, the Supabase data model, S3) attaches to Hermes
as **tools / an MCP server**, and our brand/voice/originality rules become a **Hermes skill + context file**.

## 2. The new architecture (replaces doc 06 §A topology)

```
                         ┌──────────────────────────────────────────┐
                         │      HERMES AGENT (Python platform)        │
   marketer / manager    │                                            │
   in Slack  ───────────▶│  Gateway (Slack adapter)  ← native         │
                         │  Agent loop (run_agent)                    │
                         │  Cron subsystem            ← native        │
                         │  Memory + sessions (SQLite/FTS5) ← native  │
                         │  Skills:  rehearsal-brand-voice (our spec) │
                         │  Provider: Anthropic (via AI Gateway key)  │
                         └───────────────┬────────────────────────────┘
                                         │ calls tools (MCP / plugin)
                                         ▼
                         ┌──────────────────────────────────────────┐
                         │   RSS TOOL SERVER (our code — keep this)   │
                         │   exposed to Hermes as MCP tools:          │
                         │   • generate_image / assemble_carousel     │
                         │   • publish_linkedin / publish_instagram   │
                         │   • save_draft / get_post / update_status  │
                         └───────────────┬────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            Supabase/Postgres        S3 bucket          Image model APIs
            (system of record)    (images, public        (via AI Gateway)
                                   at publish time)      + LinkedIn / IG APIs
```

Key inversion vs. the old design: **Hermes is the spine; our Fastify app is no longer the front door.**
The bespoke Slack app, the hand-built scheduler, and the hand-rolled agent loop from the old plan are
**replaced by Hermes-native subsystems**. What survives is everything that is genuinely our domain logic:
the data model, image engine, publishers, and brand/voice content.

## 3. What survives, what changes, what is deleted

**SURVIVES (Phase 0 work is NOT wasted):**
- `packages/core` — schemas, enums, zod contracts, `lockedConfig.ts`, `bannedPhrases.ts`,
  `objectStore.ts` (S3), `secrets.ts`, `db.ts`, `config.ts` (image routing). All agent-agnostic. Keep.
- `db/0001_init.sql` — the Supabase data model. Keep (it remains the system of record).
- `config/image_routing.json`, `aspect-ratios.json`, `locked-config.example.json`. Keep.
- `packages/image` (Phase 2) and `packages/publisher` (Phase 5) — keep, but expose them as Hermes tools (see §4).

**CHANGES SHAPE:**
- `packages/agent` — no longer a hand-rolled loop. Becomes the **RSS Tool Server** + the **Hermes skill/config**
  that makes Hermes behave as Rehearsal's content studio. (See §4.)
- The agent's "tools" from old doc 06 §B3 (`draft_caption`, `build_image_prompts`, `revise`, `save_draft`)
  are no longer functions we orchestrate — drafting/revising is the **Hermes agent loop itself**, guided by
  the brand skill. Only the side-effecting operations (`generate_image`, `assemble_carousel`, publish, persist)
  remain as **tools we expose to Hermes**.

**DELETED / NOT BUILT:**
- The hand-rolled AI SDK tool-loop (`hermes.ts` as a custom agent). Hermes IS the loop.
- The bespoke Slack app (events/interactions/commands endpoints, Block Kit builder, slack_ts update logic).
  Hermes' Slack gateway replaces it. (We keep the *intent* — review/approve/refine — but it happens through
  Hermes' gateway + tools, not our own Slack server.)
- The hand-built SQS scheduler for auto-ideas/scheduled posts. Hermes cron replaces it. (Publishing a
  *scheduled* post still calls our publish tool — but the scheduling/triggering is Hermes cron.)

## 4. How our logic attaches to Hermes

Build an **MCP server** ("RSS Tool Server") that exposes our operations as tools. Hermes is an MCP client,
so this is the supported, loosely-coupled seam — no forking Hermes.

Tools to expose (these are the side-effecting capabilities; reasoning stays in Hermes):
- `generate_image(prompt, job_type, aspect_ratio, style_spec?, seed?) -> {storage_key, model_used}`
- `assemble_carousel(slide_prompts, style_spec, seed) -> {images[]}`  (enforces uniform aspect ratio)
- `save_draft(post) -> {post_id}` and `get_post(post_id)`, `update_post_status(...)`
- `publish_linkedin_single`, `publish_linkedin_document` (carousel), `publish_instagram` (2-step), each
  idempotency-guarded via `publish_log`
- `compose_caption(body, platform) -> caption`  (appends locked CTA/hashtags deterministically — model never emits them)

The brand/voice/image method/originality rule become a **Hermes skill** (`skills/rehearsal-content/`) plus a
**context file** (`.hermes.md` / `AGENTS.md` equivalent in the project) so every Hermes conversation is
shaped by them. The agent drafts/refines in its own loop; it calls our tools only to render images, persist,
and publish.

Non-negotiables, re-expressed for this architecture:
- **Agent cannot publish on its own:** publish tools require an explicit human approval signal (a Slack
  approval action handled in the Hermes conversation) before the tool will execute the external call. The
  tool checks for an `approved_by` + `post_id` and refuses otherwise. (Publishing is gated in the *tool*, not
  just in prose.)
- **Locked config is data:** `compose_caption` appends CTA/hashtags from config; the model is never asked to
  produce them. Editing only touches `caption_body`.
- **Pluggable images:** unchanged — `config/image_routing.json` + adapter interface.
- **Idempotent publishing:** unchanged — `publish_log` check before any external call.
- **Originality rule:** lives in the Hermes skill — fresh hooks/angles/carousels by default; reference briefs
  are voice calibration, not a content menu; use a specific brief's story only when a human explicitly asks.

### Operational guardrails (Phase H/T — non-negotiable)

- **Supabase is the system of record.** Hermes' internal SQLite store is for its **sessions and agent memory
  only.** All post and publish state — drafts, status transitions, `publish_log`, the idea inbox — lives in
  **Supabase**, written exclusively via the RSS Tool Server tools. Never infer, reconstruct, or trust
  post/publish state from Hermes memory; the tools read/write Supabase as the single source of truth.
- **`HERMES_HOME` must sit on persistent storage.** On AWS, `HERMES_HOME` (`~/.hermes` — skills, sessions,
  memory, config) **must** be mounted on a persistent volume (e.g. EFS, or an EBS volume that survives task
  restarts). On ephemeral container storage the agent's memory and installed skill are wiped on every restart.

## 5. Stack reality (flag for the owner)

This introduces **Python** (Hermes) alongside the TypeScript tool server. That is expected and fine —
Hermes is Python; our tools can stay TS behind the MCP boundary (MCP is language-agnostic), or be rewritten
in Python if the team prefers one language. **Decision needed from owner:** keep the RSS Tool Server in
TypeScript (MCP over the wire) or port it to Python to live closer to Hermes. Default recommendation:
**keep it TypeScript as an MCP server** — preserves all Phase 0/2/5 code and keeps a clean boundary.

Deployment: Hermes runs as a long-lived gateway process (Docker on AWS is fine — it supports a Docker
backend). The RSS Tool Server runs as its own service. Both on AWS. Supabase + S3 unchanged.

## 6. Revised phase plan (supersedes old doc 04 §6 / doc 06 §B12)

- **Phase 0 — DONE, stands.** Foundation (schemas, config, S3, locked-config, data model). No rework.
- **Phase H (NEW) — Stand up Hermes + the skill.** Install Hermes; configure Anthropic provider via the
  AI Gateway key; connect the Slack gateway to a test channel; author the `rehearsal-content` skill +
  context file from docs 01/02/03 (incl. the originality rule). Acceptance: in Slack, Hermes drafts a
  Rehearsal post in-voice with no tools yet. **This absorbs the old Phase 1 (agent brain) and Phase 3
  (Slack surface) — they no longer exist as separate custom builds.**
  - QUALITY GATE (doc 01 §8) lives here now: ~15 real ideas drafted in-voice, judged by the human.
    Needs the real CTA/hashtags + AI Gateway key to close (unchanged blockers).
- **Phase 2 — Image engine, AS A TOOL.** Build `packages/image` as before, but expose `generate_image` /
  `assemble_carousel` via the RSS Tool Server so Hermes can call them. Carousel consistency gate unchanged.
- **Phase T (NEW, small) — RSS Tool Server (MCP).** Wrap save_draft/get_post/update_status/compose_caption +
  the image tools as an MCP server; register it with Hermes. (Some of this is built incrementally in Phase 2/5.)
- **Phase 5 — Publishers, AS TOOLS.** LinkedIn single (first), LinkedIn document/carousel (verify the
  document-post path), Instagram 2-step. Each an approval-gated, idempotent Hermes tool. Scheduling uses
  **Hermes cron**, not a custom scheduler.
- **Phase 4 — Web UI (optional now).** Reconsider: Slack-via-Hermes may be the only surface the team needs
  for v1. Keep the minimal intake form only if still wanted; it would POST into a tool that starts a Hermes
  conversation. Lower priority than before.
- **Phase 6 — Auto-ideas via Hermes cron.** A scheduled Hermes job that proposes ideas into Slack. Native, not custom.

## 7. Immediate next step

Acknowledge this directive, then produce a REVISED phase-wise plan reflecting Option A (Hermes core +
RSS Tool Server + skill), and WAIT for approval before building — same plan-first discipline as before.
Confirm the §5 language decision (TS MCP server vs Python port) in that plan, defaulting to TS-as-MCP.

Do not start Phase H implementation until: (a) the revised plan is approved, and (b) the owner confirms the
language decision. You may, in the meantime, read the Hermes docs (architecture, skills, MCP integration,
cron, Slack gateway) and draft the `rehearsal-content` skill from docs 01/02/03.
