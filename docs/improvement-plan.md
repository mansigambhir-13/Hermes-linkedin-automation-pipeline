# Improvement Plan — Rehearsal Social Studio

_Forward roadmap, 2026-06-03. Supersedes the remediation roadmap (now `doc-archives/ROADMAP.md`, whose Phase 0–1 items — image
portability, content-level double-post guard, the picker — are now shipped). This is the "what next, and
why" plan, ordered so each phase leaves the system shippable and unlocks the next._

Legend: 🤖 I can build · 🧑 owner/dashboard · value/effort are rough.

**Current state (baseline):** live on Render (bot + worker), Supabase system-of-record (`library_posts` +
`draft_records`), Postiz publishing (LinkedIn + X live, IG wired), 26 library posts (13 glossary with
designed images + 13 calendar, 3 of which are text-ready). Core pipeline verified: pick → review → approve
→ publish/schedule, layered idempotency, platform routing, media-required guard, em-dash sanitize.

**Precondition (not a phase):** 🧑 set `SLACK_APPROVERS` in Render to your user id (+ any co-publishers).
Until set, the allowlist defaults to "everyone" and any channel member can publish live.

---

## Phase A — Harden for unattended operation 🤖 · ~½ day · value: HIGH
The pipeline is correct; this makes *scheduled, unattended* publishing trustworthy.
- **Bounded retry/backoff in the worker.** On a transient publish failure, keep the record `scheduled`
  with `retryCount` + `nextAttemptAtMs` (exp backoff, ~3 tries) instead of dropping it to `failed`. Only
  after the last try → `failed` + ops alert. (We hit a real Postiz timeout this session.)
- **Postiz client timeouts + retry.** `AbortController` timeout on every call + 1–2 retries on idempotent
  ones (`listIntegrations`, `upload`). A hung fetch must never stall a tick.
- **`setInterval` → self-scheduling `setTimeout`.** Await each tick, then schedule the next — removes the
  overlapping-tick race entirely.
- **Forward alt text to Postiz** (it's stored + carried but dropped at the adapter). Accessibility.
- **Clean test residue:** 2 stale `in_review` rows in `draft_records`, stray Postiz draft `cmpqn56yk`.
- **DoD:** a scheduled post survives a simulated Postiz blip and still publishes once; no double-publish on
  worker restart mid-tick.

## Phase B — Visibility & control 🤖 · ~1–2 days · value: HIGH
Right now the only window into the pipeline is the DB. Give the operator eyes + recovery.
- **`/status` (or `/queue`) command:** scheduled (with times), recently published (with post links),
  failed (with reason). A **Retry** button on failed/blocked posts.
- **Daily digest** to the ops channel: what published in the last 24h, what's queued for the next 48h,
  anything failed or blocked-on-image.
- **Audit log (`publish_log` table):** who published what, when, external id, status — the missing
  system-of-record for publishes (today it lives only on `draft_records.externalIds`). Powers `/history`.
- **DoD:** owner can answer "what's going out, what went out, what broke" without touching Supabase.

## Phase C — Content operations & lifecycle 🤖 + 🧑 · ~2–4 days · value: MED-HIGH
Make adding/managing content a Slack/dashboard action, not a local script run.
- **Slack-driven intake:** an "Add post" modal (or ingest from a designated folder / Google Doc / Notion)
  that writes `library_posts` + uploads media — so new content lands without a developer machine. (A Render
  Cron running the seed against a synced content source is the low-effort version.)
- **Lifecycle states + filters:** `draft → ready → scheduled → published → archived`; `/posts` filters by
  state/platform/pillar; archive published posts so the picker stays clean.
- **Edit a library post from Slack** (caption/image) without re-seeding.
- **DR / reproducibility:** make migrations idempotent (`IF NOT EXISTS` + guard the shared-`posts`
  collision); move to a dedicated Supabase project or `rss.` schema so another app can't collide. Document
  the exact applied SQL.
- **DoD:** a non-developer can add, edit, and retire library content end-to-end.

## Phase D — Close the image gap 🤖 · ~3–5 days · value: HIGH
The biggest *content* blocker: 10 calendar posts can't ship without designed art, and every future text
post needs a visual. The glossary cards prove the template exists — productionize it.
- **Templated brand-card renderer:** programmatic (e.g. Satori/`resvg` HTML→PNG, or headless Chromium)
  that turns `tag + headline + subtitle` into the exact glossary-card layout (brand colours, rainbow
  eyebrow, wordmark/footer). Any text post → a real on-brand card, no designer in the loop for routine
  cards. Wire it as an action on the review card ("Generate card").
- **Multi-slide carousels** from a slide spec (unblocks IG/LinkedIn carousels — the calendar IG posts).
- **Keep AI image-gen (fal) as an optional, flagged path** for hero/illustrative needs only.
- **DoD:** an operator can give a text post a compliant branded image from Slack in one click; the 10
  blocked calendar posts become publishable.

## Phase E — Scheduling intelligence & calendar 🤖 · ~1–2 days · value: MED
Move from hand-picking times to calendar-driven planning.
- **Auto-schedule to the library `slot`** (parse the IST slot label → set `scheduledAtMs` on Approve), with
  manual override still available.
- **`/calendar`**: a week view of what's queued, per platform.
- **Conflict/spacing checks** (don't stack two posts in the same slot).
- **DoD:** approving a slotted post schedules it automatically; the week is visible at a glance.

## Phase F — Analytics feedback loop 🤖 · ~2–3 days · value: MED-HIGH (strategic)
Close the loop: learn what actually performs. (The shared Supabase already has a `performance` table from
the sibling app — pattern to follow, not reuse.)
- **Pull post metrics** (impressions/engagement) from Postiz / platform APIs into a `post_metrics` table.
- **Weekly performance digest**; tag top performers per pillar/platform.
- **Feed results back** into content decisions (which pillars/formats win) — and later into draft-assist.
- **DoD:** a weekly "what worked" report the team can act on. (Effort depends on Postiz analytics coverage;
  validate API availability first.)

## Phase G — v3: Hermes draft-assist 🤖 · larger · value: HIGH (strategic), higher risk
The product leap, already specced in `docs/v3-plan.md`: Hermes graduates from decision-assist (3
touchpoints) to **committed draft-assist** — corpus + retrieval + few-shot first drafts a human sharpens,
then through the same review/approve/publish loop.
- **Gated on:** (1) the exemplar/gold-corpus folder being shared, (2) the non-negotiable gold-corpus
  separation safeguard (approved-for-publish ≠ admitted-to-exemplars).
- **Best sequenced after F** (top performers become the grounding corpus). Builds on, doesn't replace, the
  v1 publishing system.

---

## Cross-cutting (do alongside, not a phase)
- **CI (GitHub Actions):** typecheck + tests on every push/PR. Cheapest possible regression insurance.
- **Integration smokes:** the DB-image publish path (row → `mintUrl` → reachable URL), library round-trip,
  the new card renderer. Today's tests use fakes only.
- **Error tracking** (Sentry or similar) beyond console + Slack ops alerts.
- **One-instance invariant:** keep the hard rule of exactly one bot + one worker (Socket Mode + scheduler).

---

## Recommended sequence
**A → B → D (in parallel with C) → E → F → G**, with CI started immediately.

- **A** is the cheap, high-value hardening — do it first so scheduling is trustworthy.
- **B** buys trust and recovery, and the `publish_log` from B is reused everywhere after.
- **D** unblocks the most content and pays off forever (every future post needs an image).
- **C** makes the system self-serve for non-developers.
- **E/F** turn it from a publisher into a *planned, measured* channel.
- **G** is the strategic leap — deliberately last, and gated.

If the goal is "operate well this week with the least new code": just **A** + the `SLACK_APPROVERS`
precondition. Everything else is value-add you can pull forward when ready.
