# Rehearsal Social Studio — Runbook & status

Single reference for what's built, how to run/verify it, and what's gated. Canonical plan: `FINAL-BUILD-PLAN.md`. Open blockers: `BLOCKERS.md`. Hermes stand-up: `infra/hermes-setup.md`.

## Phase status (2026-05-25)

| Phase | What | State |
|---|---|---|
| 0 | Foundation (`packages/core`, `db/0001_init.sql`, `config/*`) | ✅ built + verified |
| T | RSS Tool Server (MCP) — compose_caption, save_draft, get_post, update_post_status, save_idea, generate_image, assemble_carousel, publish_* | ✅ built; smoke green |
| 2 | Image engine → **fal** (recraft/ideogram/imagen4) | ✅ code-complete; **carousel gate RAN** (5 sets in `.artifacts/posts/c1..c5/`) — awaiting human consistency judgment |
| H | Hermes core + `rehearsal-content` skill + Slack gateway | 🟡 wiring + skill + MCP-registration + runbook done; **live stand-up gated** (interactive install + Bedrock use-case form) |
| T+ | Caption-gate eval (`apps/caption-eval`) → **Bedrock** | 🟡 built + bedrock invoke verified once; **batch gated on the AWS use-case form approval** |
| 5 | Publishers (LinkedIn/IG) as approval-gated, idempotent tools + Hermes-cron scheduling | ✅ code-complete; smoke green; **go-live gated** (LinkedIn OAuth + Meta review) |
| 4 | Web UI (optional) — `apps/web/index.html` static intake form | ✅ minimal/code-complete (Slack-via-Hermes is the v1 surface) |
| 6 | Auto-ideas — `save_idea` tool + Hermes-cron task | ✅ seam done; generation is a Hermes cron task (`infra/hermes-setup.md` §6) |

## Verify now (no external creds)
```
pnpm typecheck
pnpm --filter @rss/tool-server smoke     # MCP server builds, all tools register
pnpm --filter @rss/publisher  smoke      # approval gate + idempotency + state machine
pnpm exec tsx packages/image/scripts/smoke.ts   # image pipeline (stub adapter)
```

## Run with creds in `.env`
```
node --env-file=.env --import tsx packages/image/scripts/verify-fal.ts          # single fal render  (✅ works)
node --env-file=.env --import tsx packages/image/scripts/carousel-gate.ts        # carousel gate (5 sets) (✅ ran)
node --env-file=.env --import tsx apps/caption-eval/scripts/verify-bedrock.ts     # bedrock invoke (gated on use-case form)
pnpm --filter @rss/caption-eval gate                                              # 15-caption gate (gated on use-case form)
pnpm --filter @rss/web serve                                                      # static intake form
```

## Gated on the team / external approvals (see BLOCKERS.md)
- **Bedrock Anthropic use-case form approval** → caption gate.
- **Carousel consistency human judgment** (≥~70% on the rendered sets) → Phase 2 pass.
- **CTA + hashtags** → `config/locked-config.json` → caption gate *close* + `compose_caption`.
- **`DATABASE_URL`** (Supabase) → persistence + migration apply.
- **LinkedIn OAuth target/token** + **Meta app review** → publishing go-live.
- **Hermes live install** (interactive) → the conversational Slack loop + cron.
- **Rotate** the retired gateway key + Slack token (were plaintext).
