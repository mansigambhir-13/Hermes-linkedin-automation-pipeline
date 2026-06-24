# Rehearsal Social Studio — Operational Setup Checklist

**The human tasks. These are accounts, accesses, and decisions that code can't create.**
Work the "critical path" items first — especially Meta app review, which gates Instagram publishing by weeks.

---

## Critical path — start these on day one (they have lead times)

- [ ] **Meta / Instagram publishing access** (longest lead time, ~2–4 weeks for app review):
  - [ ] Convert the Rehearsal Instagram account to a **Professional (Business or Creator)** account.
  - [ ] Create / confirm a **Facebook Page** and link the Instagram account to it.
  - [ ] Create a **Meta developer app**.
  - [ ] Request the **content-publishing permission** and submit for **app review**.
  - [ ] **Name the owner today** — a specific person with Business-account admin access — and start the submission now. This is the critical path: it gates Instagram publishing by weeks regardless of code velocity. Code can't do this; a named person must, today.
- [ ] **LinkedIn API access**:
  - [ ] Decide posting target: company page vs personal/creator account.
  - [ ] Create a LinkedIn developer app; request posting scopes; authorize OAuth.

## Accounts & credentials to provision

- [ ] **AWS**: account access, an S3 bucket (public/presigned URL capable), Secrets Manager, and EventBridge/cron for scheduling.
- [ ] **Supabase**: project created; connection string + service role key available to the backend.
- [ ] **Slack**: create a Slack app in the workspace; bot token, signing secret, the channel(s) for review + idea inbox.
- [ ] **Image model API keys**: keys for the chosen providers (e.g. the photorealism model, the in-image-text model, the carousel-consistency model). Determines the default per-job routing.
- [ ] **Claude API key**: for the agent and for scheduled auto-idea generation.

## Decisions the team must supply (the agent must not invent these)

- [ ] **Locked CTA style** — the exact call-to-action wording/format the team wants on posts. **(Start now — Phase-0 prerequisite; blocks closing the Phase-1 caption gate.)**
- [ ] **Per-platform hashtag sets** — the fixed LinkedIn set and the Instagram block. (If a canonical set already exists, hand it over verbatim and note the exact count so it's not mislabeled.) **(Start now — Phase-0 prerequisite; blocks closing the Phase-1 caption gate.)**
- [ ] **Carousel default slide count** — a default (e.g. 4–6) or always the user's choice.
- [ ] **Auto-idea cadence** — frequency, and whether to tie ideas to placement-season / exam timing.
- [ ] **Approval policy** — who in the team is the approving social manager; whether any post type can skip review (recommend: none in v1).

## Brand assets to gather (sharpen the visual quality)

- [ ] Any **logo files, exact brand colors (hex), and the brand fonts** (the editorial serif + the sans), so image prompts and any overlay typesetting match precisely.
- [ ] **2–5 reference images** of the look you want (the brief-cover illustration style is a strong reference) — these anchor the carousel style spec and lift consistency. **(Start now — Phase-2 prerequisite; raises the consistency floor but does not by itself guarantee the ≥70% gate.)**
- [ ] Confirm the **conceptual-illustration direction** vs any photographic direction, so the image engine's default style is right.

## Quality gates to honor during build (don't skip)

- [ ] **Caption quality gate (Phase 1):** ~15 real ideas drafted; on-brand and publishable with light edits, judged against the Brand & Voice Spec bar. **Part of the judgment: is each a *fresh* hook/angle, not a rehash of a reference brief?** (Originality rule — 03-agent-instructions §5.7 — enforced in the agent's system prompt, tested here.)
- [ ] **Carousel consistency gate (Phase 2):** ~15 real carousels; the consistency checklist passes ≥ ~70% before publishing is built on top. This is the highest-risk area — treat the gate as mandatory.

## Go-live readiness

- [ ] LinkedIn one-click publish verified end-to-end on a test post.
- [ ] Instagram publish verified end-to-end **after** Meta review clears (single image first, then carousel).
- [ ] Scheduler verified: a scheduled post fires at the right time, exactly once (no double-publish).
- [ ] Failure surfacing verified: a failed generation or publish shows up in Slack for a human.
- [ ] Secrets confirmed in AWS Secrets Manager; none in the repo.

---

### The one thing not to forget
Meta app review is the long pole. If only one item gets started today, make it that one — everything else can proceed in parallel, but Instagram publishing simply cannot go live until review clears.
