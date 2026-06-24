# Render deploy runbook — Rehearsal Social Studio

Repo: `mansigambhir-1313/rehearsal-social-studio` (private). Blueprint: `render.yaml` (already in the repo).
Two **Background Workers** (no public URL — Slack Socket Mode + Supabase + Postiz are all outbound):
`rss-bot` (`pnpm start:bot`) and `rss-worker` (`pnpm start:worker`), sharing the `rss-shared` env group.

> Code is done & hardened. This is operational: deploy the blueprint, paste secrets, smoke-test.
> Cost: Render Background Workers need a paid instance — Starter ≈ $7/mo each (~$14/mo total).

---

## Phase 0 — pre-deploy cleanup
- [x] **Orphan Postiz draft deleted** (done via API).
- [ ] **Delete the wrong-platform LinkedIn post** on the GradelessAI page (the X-content post that went to LinkedIn). LinkedIn page admin → find post → Delete. *(Only you can do this.)*
- [ ] **Rotate the dev keys** that were exposed during the build (Slack tokens, Anthropic, Postiz, Supabase DB password) and use the **new** values in Render below. Strongly recommended before a live brand account runs unattended.

## Phase 1 — create the services (Blueprint)
1. Render Dashboard → **New → Blueprint**.
2. **Connect GitHub** → authorize → pick **`rehearsal-social-studio`**.
3. Render reads `render.yaml` and shows: **rss-bot**, **rss-worker**, env group **rss-shared**. Click **Apply**.

## Phase 2 — set the secrets (env group `rss-shared`)
The blueprint already fills the non-secret config (CONTENT_LIBRARY=supabase, DRAFT_STORE=supabase, PUBLISHER_ADAPTER=live, the Postiz integration IDs, the Slack intake channel, etc.). Render will prompt for the **`sync:false`** secrets — paste each (use the **rotated** values):

| Key | Value (from your `.env`) |
|---|---|
| `SLACK_BOT_TOKEN` | `xoxb-…` |
| `SLACK_APP_TOKEN` | `xapp-…` (Socket Mode) |
| `SLACK_SIGNING_SECRET` | … |
| `ANTHROPIC_API_KEY` | `sk-ant-…` |
| `POSTIZ_API_KEY` | … |
| `DATABASE_URL` | `postgresql://postgres.ceknijyoqvngevzexcmo:<URL-ENCODED-PW>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres` |
| `SLACK_APPROVERS` *(recommended)* | comma-separated Slack user IDs allowed to publish |
| `SLACK_OPS_CHANNEL` *(recommended)* | channel ID for failure alerts |

> ⚠️ `DATABASE_URL` — keep the password **URL-encoded** (the `#` stays `%23`). Copy the exact line from your `.env`.

No DB setup needed: `library_posts` (13 posts) and `draft_records` are already created + seeded in Supabase.

---

## Verified commands & env reference (do NOT guess — checked against the code)

### Build & start (the blueprint already sets these; here's the why)
- **Build command:** `corepack enable && pnpm install --frozen-lockfile`
  - ❌ **Do NOT add `pnpm build`.** The root `tsconfig.json` has `"noEmit": true` — `pnpm build` compiles nothing (the app runs via **tsx**, TypeScript directly). Adding it is pointless and *fails the deploy on any type nit*.
  - `tsx` is a **runtime dependency** (not devDep), so it survives `NODE_ENV=production` install pruning.
- **Start command — `rss-bot`:** `pnpm start:bot`  (→ `pnpm --filter @rss/slack-bot start`)
- **Start command — `rss-worker`:** `pnpm start:worker`  (→ `pnpm --filter @rss/worker start`)
- **Node:** 22 (set via `NODE_VERSION=22` + `.node-version`).

### Env vars — the complete, verified set
**A. Set automatically by the blueprint — you do NOT enter these** (non-secret, committed in `render.yaml`):
`NODE_ENV=production` · `CONTENT_LIBRARY=supabase` · `DRAFT_STORE=supabase` · `PUBLISHER_ADAPTER=live` · `OBJECT_STORE=local` · `ANTHROPIC_MODEL=claude-sonnet-4-6` · `POSTIZ_API_URL=…/public/v1` · `LOCKED_CONFIG_PATH=config/locked-config.json` · `POSTIZ_INTEGRATION_LINKEDIN` · `POSTIZ_INTEGRATION_X` · `POSTIZ_INTEGRATION_INSTAGRAM` · `SLACK_INTAKE_CHANNEL`

**B. You paste these (secrets — mark "Secret" in Render):**
| Key | Required? | Notes |
|---|---|---|
| `SLACK_BOT_TOKEN` | ✅ required | fresh `xoxb-…` |
| `SLACK_APP_TOKEN` | ✅ required | fresh `xapp-…` (Socket Mode, `connections:write`) |
| `ANTHROPIC_API_KEY` | ✅ required | fresh `sk-ant-…` |
| `POSTIZ_API_KEY` | ✅ required | the Postiz public-API key |
| `DATABASE_URL` | ✅ required | Supabase pooler URI; **URL-encode `#`→`%23`** |
| `SUPABASE_SERVICE_ROLE_KEY` | ◻ for images | Supabase → Settings → API → `service_role`. Only needed to upload/serve media; text-only publishing works without it. |
| `SLACK_SIGNING_SECRET` | ◻ recommended | harmless in Socket Mode |
| `SLACK_APPROVERS` | ◻ recommended | comma-separated user IDs — **set before go-live or anyone can publish** |
| `SLACK_OPS_CHANNEL` | ◻ recommended | channel ID for failure alerts |

> The bot's boot log prints a `config check` with ✅/❌ per var — if you miss a required one, it fails fast and names it.

**C. NOT needed for v1 — leave unset** (legacy/optional): `BEDROCK_MODEL` (retired), `LINKEDIN_*`/`META_*`/`IG_USER_ID` (legacy direct adapters — Postiz replaces them), `FAL_API_KEY` (only `/draft` image generation), `GEMINI_*` (dormant), `S3_*` (only if `OBJECT_STORE=s3`), `WORKER_INTERVAL_MS`/`DRAFT_RATE_LIMIT_PER_HOUR` (have sensible defaults).

---

## Phase 3 — cut over (avoid two bots)
Slack Socket Mode with the same app token on **two** running bots = duplicate event handling.
- Before/when the Render `rss-bot` shows "connected", **stop the local bot** (the one running in the dev session). One bot only.

## Phase 4 — smoke test (read the Render logs)
- **rss-bot** logs should show the `[slack-bot] config check` (all required ✅), then `⚡ … connected via Socket Mode`.
- **rss-worker** logs should show `[worker] config check`, then `⏱️ … worker started — polling every 30s`.
- In Slack: run **`/posts`** → Select a post → review card → **Approve** → **Publish**. Confirm it posts.
- (Optional) Schedule a post a few minutes out → watch `rss-worker` logs fire it.

## Ops notes
- **Exactly one** `rss-bot` and **one** `rss-worker` — never scale these horizontally (Render: keep instance count = 1).
- `autoDeploy: true` → pushing to `main` redeploys. The Supabase draft store survives redeploys.
- Health/intake runs on an internal port (not exposed); the real interface is Slack Socket Mode.
- Failures alert `SLACK_OPS_CHANNEL` (once set); crash guards keep the process up; `SIGTERM` shuts down cleanly on redeploy.

## If a deploy fails
- **`tsx: not found`** → ensure the build used `pnpm install --frozen-lockfile` (tsx is a runtime dependency now). Re-trigger deploy.
- **`missing required env`** at boot → a required secret wasn't set in `rss-shared`. The boot log names it.
- **DB auth `tenant/user not found`** → wrong pooler host or unencoded password in `DATABASE_URL`.
