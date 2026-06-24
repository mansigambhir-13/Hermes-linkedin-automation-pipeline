# Render deploy checklist — Hermes (image-generation pipeline)

Single source of truth for standing up **all services** of this deployment on Render.
Repo: `mansigambhir-13/Hermes-linkedin-automation-pipeline` · Blueprint: [`render.yaml`](../render.yaml)

The app is **two Background Workers**, not web services — the Slack bot runs in
**Socket Mode** (outbound), so neither service needs public ingress or a URL.

| Service | Role | Runtime | Plan | Needs Chromium? |
|---|---|---|---|---|
| `rss-bot` | Slack review surface + `composeDraft` (renderer) | **docker** (Dockerfile) | **standard** (~2 GB) | **yes** — deterministic HTML→PNG renderer |
| `rss-worker` | publishes approved drafts (Postiz) | node | starter | no |

> A **Free / Node web service cannot run this** — Node runtime ignores the Dockerfile
> (no Chromium → `/draft` crashes), 512 MB is below the ~1 GB Chromium floor, and Render
> has no free tier for workers. Deploy the Blueprint; don't hand-build a service.

---

## ✅ Already done (in the repo / DB)
- [x] Code pushed to `main`; `render.yaml` set to Docker + Standard for `rss-bot`.
- [x] Blueprint non-secret values filled: `SUPABASE_URL`, `SUPABASE_BUCKET=post-media`,
      Postiz channel IDs, `SLACK_INTAKE_CHANNEL`.
- [x] **Database ready** (Supabase `ceknijyoqvngevzexcmo`): schema migrated (4 migrations),
      `library_posts` seeded (39 rows), draft store live. Workers won't fail-fast on the DB.

## 1. External prerequisites (must exist before the workers boot)
- [ ] **Supabase** — confirm the `post-media` storage bucket exists and is **public**
      (DB schema + library are already done; re-run only if you reset the project:
      `pnpm --filter @rss/core db:migrate && pnpm --filter @rss/core seed-library`).
- [ ] **Slack app** — Socket Mode **on**; bot invited to channel `C0B5PKLL4UT`.
      Full steps: [`infra/slack-setup.md`](./slack-setup.md). You'll need:
      `SLACK_BOT_TOKEN` (`xoxb-`), `SLACK_APP_TOKEN` (`xapp-`, `connections:write`), `SLACK_SIGNING_SECRET`.
- [ ] **Postiz** — LinkedIn / X / Instagram channels connected (their IDs are already in the
      Blueprint); copy the key from Settings → Developers → Public API.

## 2. Deploy the Blueprint
- [ ] Delete any hand-built service for this repo (e.g. a Free Node web service — wrong type).
- [ ] Render Dashboard → **New → Blueprint** → connect this repo → **Apply**.
      Creates `rss-bot`, `rss-worker`, and the `rss-shared` env group.
- [ ] Render prompts for the `sync:false` secrets — paste:

  | Secret | Source |
  |---|---|
  | `ANTHROPIC_API_KEY` | Anthropic console |
  | `SLACK_BOT_TOKEN` | Slack app → OAuth (`xoxb-`) |
  | `SLACK_APP_TOKEN` | Slack app → App-Level Tokens (`xapp-`) |
  | `SLACK_SIGNING_SECRET` | Slack app → Basic Information |
  | `DATABASE_URL` | Supabase → Settings → Database (Postgres URI) |
  | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
  | `POSTIZ_API_KEY` | Postiz → Developers → Public API |
  | `SLACK_APPROVERS`, `SLACK_OPS_CHANNEL` | optional governance (recommended) |

## 3. Verify
- [ ] **rss-bot** build log shows Chromium installing (`playwright install … chromium`),
      then the bot connecting over Socket Mode. In Slack: `/draft <idea>` → returns a typeset
      card. *(This is the renderer — the thing Free/Node could never do.)*
- [ ] **rss-worker** log shows it polling every 30 s; approve a draft → it publishes via Postiz.

## Cost & guardrails
- `rss-bot` Docker + Standard ≈ $25/mo · `rss-worker` Node + Starter ≈ $7/mo → **≈ $32/mo**.
- Hard rule: exactly **one** bot + **one** worker (no horizontal scaling).
- `VISUAL_MODE` defaults to `render` (deterministic, on-brand, free — no fal key needed).
  `ai`/`hybrid` need `FAL_API_KEY` and cost per image.

## Known follow-ups (not deploy blockers — see the gap analysis)
- Draft image URLs use a timestamp-derived id on a public bucket → enumerable before approval.
  Prefer random post ids / signed URLs.
- `composeDraft` instantiates `RenderEngine` per call (pipeline) vs a singleton (tool-server);
  mirror the singleton + concurrency cap before high burst.
- No storage retention/TTL; hybrid writes `_bg` + final PNGs.
- Wire a real readiness check (the renderer launches Chromium lazily, so a broken image still
  boots "healthy").
