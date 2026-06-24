# Slack pipeline — setup & live wiring (`@rss/slack-bot`)

The Slack review/publish surface: a marketer types `/draft <idea>` → the bot drafts an on-brand caption
(Bedrock gpt-oss) + generates the image/carousel (fal) → posts a **review card** (caption + uploaded
image(s)) with **Approve / Regenerate / Publish → LinkedIn / Publish → Instagram** buttons. Nothing
auto-publishes; Publish is approval-gated and idempotent.

> **Architecture note (Directive 01).** Long-term, Hermes owns the Slack agent loop. This bot is the
> runnable interim surface that drives the *same* primitives Hermes will (`@rss/agent` pipeline +
> `@rss/publisher`), so it can later be fronted by / swapped for the Hermes gateway without reworking the
> pipeline. The pipeline (`composeDraft`) is transport-agnostic.

## What works today (verified)
- **Full review loop**: `/draft` → caption + image(s) review card → **Approve · ✏️ Edit · 💬 Refine ·
  🔄 Regenerate · 🗓️ Schedule · Publish → LinkedIn/Instagram**.
  - **Edit** opens a modal to hand-edit the caption; **Refine** opens a modal for an instruction
    ("punchier; lead with the CV angle") and re-drafts; **Regenerate** re-runs the same idea.
  - **Schedule** records a time (firing is the worker/Hermes cron's job — not yet running).
  - **Publish** is session-backed (no DB needed): approval-gated + idempotent, runs the real (gated)
    adapter so without creds/public URLs it returns a clear refusal — never a fake success.
- `composeDraft` end-to-end (idea → caption → image), both single **and carousel**, verified via the
  no-Slack CLI: `node --env-file=.env --import tsx apps/slack-bot/scripts/compose.ts "your idea"`
  (`PLATFORM=instagram FORMAT=carousel` to vary). Writes images under `.artifacts/posts/slack-*/`.
- `pnpm --filter @rss/slack-bot smoke` — no-network smoke (parsing, 7 actions, modal, app construct). Typecheck clean.

## Env
In `.env`: `SLACK_BOT_TOKEN` + (`SLACK_APP_TOKEN` for Socket Mode **or** `SLACK_SIGNING_SECRET` for HTTP).
Also needs `BEDROCK_MODEL` + `FAL_API_KEY` (already set). Optional `SLACK_PORT` (default 3001, HTTP only).
The bot auto-selects: **`SLACK_APP_TOKEN` present ⇒ Socket Mode**, else HTTP mode.

## Go live — Socket Mode (recommended; no tunnel)
Socket Mode connects outbound over a WebSocket, so `/draft` + buttons + modals all work with **no public
Request URL**. One-time dashboard setup at <https://api.slack.com/apps> → your @hermes app:

1. **Socket Mode** (left nav) → toggle **Enable Socket Mode** ON.
2. **Basic Information → App-Level Tokens** → *Generate Token and Scopes* → add scope **`connections:write`**
   → create → copy the **`xapp-…`** token → put it in root `.env` as `SLACK_APP_TOKEN=xapp-…`.
3. **OAuth & Permissions → Bot Token Scopes**: add `commands`, `chat:write`, `files:write` → **Reinstall** the app.
4. **Slash Commands** → *Create New Command* → Command `/draft`, a short description, usage hint
   `[linkedin|instagram] [single|carousel] <idea>`. (In Socket Mode there is **no Request URL field**.)
5. **Interactivity & Shortcuts** → toggle ON (no Request URL needed in Socket Mode — it enables button/modal delivery).
6. Run it: `pnpm --filter @rss/slack-bot start` → logs `⚡ … connected via Socket Mode`.
7. In Slack, `/invite @hermes` to a channel, then: `/draft linkedin single a fresh take on GD-PI nerves`.

## Web intake (second surface)
The bot also serves the intake form (`apps/web/index.html`) at `http://localhost:${SLACK_INTAKE_PORT:-3002}` and
accepts `POST /api/posts`. A submission runs the pipeline and posts the draft into **`SLACK_INTAKE_CHANNEL`**
(a Slack channel ID where `@hermes` is invited) for review — same review card + buttons as `/draft`.
- Set `SLACK_INTAKE_CHANNEL=Cxxxxxxxx` in `.env` (in Slack: channel → About → copy the Channel ID, or right-click → Copy link).
- v1 normalisation: platform `both` → LinkedIn, format `auto` → single image (one draft per submission).
- Open `http://localhost:3002`, enter an idea, submit → watch the channel.

## Alternative — HTTP mode (needs a public tunnel)
Leave `SLACK_APP_TOKEN` empty; the bot serves Bolt's HTTPReceiver on `:3001` at `…/slack/events`.
`ngrok http 3001`, then set the **Slash Command** + **Interactivity** Request URLs to
`https://<tunnel>/slack/events`. Same bot scopes as above.

## Gates (honest status)
- **Persisting drafts / approvals to Supabase** — the bot keeps draft sessions **in memory** (lost on
  restart) until `DATABASE_URL` is set. The publish path is **session-backed** (`makeInMemoryPublishDeps`),
  so the loop runs without a DB; swapping to `makePublishDeps` (the `save_draft`/`getPost` system-of-record
  path) is the next step when `DATABASE_URL` lands. *(blocker 10)*
- **Publish buttons** run the real adapter via `@rss/publisher` (approval-gated, idempotent). They
  **fail-safe**: with no LinkedIn OAuth / Meta creds — and, in local object-store mode, no public image URLs —
  they reply with a clear refusal rather than a fake success. Go-live needs LinkedIn OAuth + Meta app review
  (+ S3/public URLs for Instagram). *(blockers 1, 5)*
- **CTA/hashtags** — the review card shows `⚠️ CTA/hashtags stubbed (provisional)` until
  `config/locked-config.json` lands; then it shows `✅ applied`. *(blockers 2, 3)*
