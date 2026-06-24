# Operating guide — Rehearsal Social Studio

One page for the team. The system is **live on Render** and runs 24/7. You drive it from **Slack**.

## What it does
Publishes pre-made posts to **LinkedIn + X** (Instagram wired, needs images) via Postiz, with a human approving every post. Hermes (Claude) assists: validates brand voice + platform fit, answers questions, and adapts a post across platforms.

## Daily flow
1. **`/posts`** in Slack → a list of ready posts (title · platform · pillar · slot).
2. Click **Select** on one → a review card appears (caption + image + 📚 source).
3. On the card:
   - **🔎 Re-evaluate** — Claude's brand-voice + platform-fit verdict.
   - **✏️ Edit** — tweak the caption.
   - **🔁 Adapt for <other platform>** — Hermes rewrites it natively for the other platform (new card).
   - **✅ Approve** → **Publish → LinkedIn / X** (publishes now), or **🗓️ Schedule** (worker publishes it when due).
4. Done. Scheduled posts fire automatically — no one needs to be watching.

## Chatting with Hermes
DM the bot, or `@mention` it in a channel (then keep replying in that thread, no tag needed). Ask it: "what's in the queue?", "should this go on X or LinkedIn?", "what's the no-em-dash rule?". It never writes posts — that's human work.

## Who can publish
Only Slack users in **`SLACK_APPROVERS`** can Approve / Schedule / Publish. To add a publisher: add their Slack member ID (Profile → Copy member ID) to the `SLACK_APPROVERS` env var in Render → save (redeploys).

## Adding new content
- Put the finished post `.md` in **`content/ready/`** (one file per platform; filename includes `-linkedin-`/`-x-`/`-instagram-`), then run **`pnpm --filter @rss/core seed-library`** (uploads any image to Supabase Storage automatically) — or write straight into the `library_posts` table.
- **Instagram needs an image** (it mandates media); text-only IG posts show "needs an image" and can't publish.

## Built-in guardrails (you don't have to think about these)
- **No double-post** — the same post can't publish to the same platform twice (a duplicate is refused with a message).
- **No auto-posting** — nothing publishes without a human Approve.
- **Platform-aware** — each card only offers its own platform's publish button.
- **No em dashes** — stripped from every post automatically.
- **Idempotent** — re-clicking or a worker restart never re-posts.

## If something breaks
- **Failure alerts** post to **#rehearsal-social** (`SLACK_OPS_CHANNEL`).
- **Logs:** Render dashboard → `rss-bot` (Slack/publish) or `rss-worker` (scheduling).
- **Crashes** auto-restart. To force a restart: Render → service → **Manual Deploy → Restart**.
- **Bot not responding?** Check `rss-bot` logs for "connected via Socket Mode". If a config var is missing, the boot log names it (fail-fast).

## The two services (Render)
- **`rss-bot`** — the Slack app (Socket Mode): `/posts`, chat, review/publish.
- **`rss-worker`** — the scheduler: publishes due scheduled posts every 30s.
> Rule: exactly **one** of each. Never scale to >1 instance.

## Known limits (today)
- Images/Instagram: pipeline ready, **awaiting image content** (current posts are text-only).
- New content needs a manual `seed-library` run (automation is a later step).

---
_Architecture + deploy detail: `STATUS.md`, `DEPLOY.md`, `RENDER.md`. Future direction: `docs/v3-plan.md`._
