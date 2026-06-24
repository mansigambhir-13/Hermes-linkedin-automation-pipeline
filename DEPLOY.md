# Deployment — Rehearsal Social Studio

The system is **two long-lived processes** that share one Supabase database:

| Process | Command | Role |
|---|---|---|
| **bot** | `pnpm start:bot` | Slack Socket-Mode app (`/posts`, `/draft`, chat, review cards, publish) + web-intake/health on `:3002` |
| **worker** | `pnpm start:worker` | polls the draft store and publishes **scheduled** posts when due |

Both connect outbound (Slack Socket Mode, Supabase, Postiz, Anthropic) — **no inbound ports or public URL required** (except the optional `:3002` health/intake endpoint).

---

## 1. Prerequisites
- **Node ≥ 22**, **pnpm** (via `corepack enable`).
- A Supabase project (Postgres). Provider accounts: Slack app, Postiz, Anthropic, fal (only if using `/draft` image generation).

## 2. Environment variables
Copy `.env.example` → `.env` (local) or set these in the host's env (prod). Startup **fails fast** with a clear report if a required one is missing.

**Required**
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` (Socket Mode), `ANTHROPIC_API_KEY`
- `POSTIZ_API_KEY`, `POSTIZ_INTEGRATION_LINKEDIN`, `POSTIZ_INTEGRATION_X`
- `DATABASE_URL` (Supabase pooler URI — **URL-encode special chars in the password**, e.g. `#`→`%23`)
- `CONTENT_LIBRARY=supabase`, `DRAFT_STORE=supabase`

**Recommended**
- `SLACK_APPROVERS` (comma-separated user IDs allowed to Approve/Publish — otherwise anyone can)
- `SLACK_OPS_CHANNEL` (channel ID for publish-failure alerts)
- `SLACK_INTAKE_CHANNEL`, `ANTHROPIC_MODEL`, `WORKER_INTERVAL_MS`, `PUBLISHER_ADAPTER=live`

## 3. One-time database setup
```bash
pnpm db:migrate        # idempotent; library_posts + draft_records already applied for the current project
pnpm seed-library      # loads content/ready/*.md into library_posts
```
> Note: this Supabase project is **shared** with another app (it has a `posts` table with a `bigint` id). Do **not** run `0001_init`/`0002`'s `posts`/`post_images` — only `library_posts` (0003) and `draft_records` (0002's draft table) are used, and both are already applied. The draft store uses `draft_records` (no collision).

## 4. Run

### Option A — Docker (any container host)
```bash
docker build -t rss .
docker run --env-file .env rss                       # bot
docker run --env-file .env rss pnpm start:worker     # worker
```

### Option B — Railway / Render / Fly.io (Procfile)
Two services from one repo:
- **bot** → start command `pnpm start:bot`
- **worker** → start command `pnpm start:worker`
Set the env vars in each service's dashboard. (The `Procfile` declares both.)

### Option C — VM / always-on Mac (pm2)
```bash
pnpm install
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup   # restart on reboot
```
`ecosystem.config.cjs` runs both processes with auto-restart.

## 5. Health & observability
- **Health:** `GET http://<host>:3002/health` → `ok` (point your platform's healthcheck here).
- **Failures:** publish failures post to `SLACK_OPS_CHANNEL` (and stderr). Crash guards keep the process alive on stray errors; `SIGTERM`/`SIGINT` shut down cleanly.

## 6. Scaling / hard rules
- **Run exactly ONE worker instance.** Two workers could each pick the same due post. (Idempotency makes a double-publish unlikely, but one worker is the rule.)
- **Run exactly ONE bot instance** — Slack Socket Mode + the `:3002` intake port assume a single process.
- **Idempotency is durable** (recorded on the draft record in Supabase): a re-click or restart will not double-post the same draft to the same platform.

## 7. Security before go-live
- **Rotate every key** that was pasted during development (Slack, Anthropic, Postiz, fal, Supabase password) — assume they're exposed.
- Inject secrets via the host's secret manager / env — never commit `.env` (it's gitignored).
- Set `SLACK_APPROVERS` so only authorized people can publish.

## 8. Pre-flight checklist
- [ ] All required env vars set; `requireEnv` report is all ✅ at boot.
- [ ] `pnpm typecheck` clean, `pnpm test` green, `pnpm --filter @rss/slack-bot smoke` OK.
- [ ] `db:migrate` + `seed-library` run; `/posts` lists posts from Supabase.
- [ ] One bot + one worker running under a supervisor (Docker restart / pm2 / platform).
- [ ] Keys rotated; `SLACK_APPROVERS` + `SLACK_OPS_CHANNEL` set.
- [ ] Health check green; a test schedule fires via the worker.
