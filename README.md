# Rehearsal Social Studio

Slack-driven social publishing for **Rehearsal** (by Gradeless.ai). A human picks a finished post in
Slack (`/posts`), reviews it on a card (validate · refine · adapt · edit), and publishes or schedules it
to **LinkedIn / X / Instagram** via Postiz. Hermes (Claude) assists with judgment — brand-voice
validation, platform fit, refinement, smart hashtags, chat — and **never publishes on its own**.

```
Slack (#rehearsal-social)                 Render (Singapore)
  /posts picker ──► review card ──► bot ──► Postiz ──► LinkedIn / X / IG
  chat / refine / adapt   ▲          │
                          │          ▼
                     Anthropic   Supabase: draft_records (state) ·
                     (Claude)    library_posts (content) · Storage (media)
                                     ▲
                       worker ───────┘  (publishes approved scheduled posts;
                                         retry/backoff; exactly ONE instance)
```

## Quickstart (local dev)
```bash
corepack enable && pnpm install
cp .env.example .env          # fill real values — never commit .env
pnpm typecheck && pnpm test   # 11 unit tests
pnpm start:bot                # Slack Socket-Mode bot (ONE instance only — see SECURITY.md)
pnpm start:worker             # scheduler (separate process)
```
Production runs on Render via `render.yaml` (two Background Workers, autoDeploy on `main`,
gated by CI: secret-scan + typecheck + tests on every push).

## Repository map
| Path | What |
|---|---|
| `apps/slack-bot` | the Slack app: `/posts`, review cards, chat, publish |
| `apps/worker` | scheduling worker (due posts → publish, with retry/backoff) |
| `apps/tool-server`, `apps/web`, `apps/caption-eval` | dormant: MCP tool server, web intake, eval probe |
| `packages/core` | schemas, brand context, DB, object storage, content library, locked config |
| `packages/agent` | draft store, Anthropic decisioning (validate / chat / adapt / refine / hashtags) |
| `packages/publisher` | publish state machine + Postiz adapter (guards live here) |
| `packages/image` | fal image generation (dormant — `/draft` disabled in prod) |
| `db/` | live migrations (idempotent) · `db/legacy/` superseded original schema |
| `content/ready/` | calendar post sources (md) — seed via `seed-library` |
| `brand/`, `SOCIAL-POSTING-GUIDELINES.md` | brand voice — loaded into Hermes's context at runtime |
| `config/` | locked CTA/hashtag config (team-supplied) |
| `scripts/` | repo-level utilities (secret scan) |
| `test/` | unit tests for the non-negotiables |
| `doc-archives/` | superseded planning docs & original specs — history, not guidance |

## Documentation
**Operate** · [`SLACK-GUIDE.md`](SLACK-GUIDE.md) (non-technical operator guide) ·
[`OPERATING.md`](OPERATING.md) (ops one-pager) · [`docs/test-plan.md`](docs/test-plan.md) (E2E test plan)

**Deploy & secure** · [`RENDER.md`](RENDER.md) (deploy runbook) · [`DEPLOY.md`](DEPLOY.md) (host-agnostic) ·
[`SECURITY.md`](SECURITY.md) (posture + owner checklist) · [`.env.example`](.env.example)

**Understand & plan** · [`STATUS.md`](STATUS.md) (what's live, what Hermes is/isn't) ·
[`docs/improvement-plan.md`](docs/improvement-plan.md) (forward roadmap A–G) ·
[`docs/platform-formats.md`](docs/platform-formats.md) (per-platform shape spec) ·
[`docs/v3-plan.md`](docs/v3-plan.md) (draft-assist future)

**History** · everything in [`doc-archives/`](doc-archives/) (original specs, build plans, change
directives, superseded runbooks) — kept for context; **do not** follow as current guidance.

## Non-negotiables (enforced in code — see `SECURITY.md`)
Human approval on every publish · durable idempotency (no double-posts) · platform routing ·
media-required and unfilled-`[[DATA]]` publish blocks · no fabricated evidence in AI refinement ·
no em dashes · exactly one bot + one worker.
