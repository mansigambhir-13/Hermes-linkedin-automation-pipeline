# End-to-end test plan — Rehearsal Social Studio

_2026-06-04. Covers the system as deployed: `/posts` picker → review card (Edit / Re-evaluate / Make
brand-ideal / Adapt / Schedule / Publish) → Postiz (LinkedIn + X + IG) → scheduling worker with
retry/backoff; Supabase system-of-record; Hermes chat; CI gate._

## How to use this plan
- **Order:** Suite A is continuous (CI). Run B → C → D → E → F top-to-bottom; C is safe (nothing
  publishes), D touches **real accounts**, E exercises the worker, F is chaos/ops.
- **Roles:** 🧑 = owner in Slack / Render / Postiz dashboards · 🤖 = Claude can run it (queries, scripts, CI).
- **Where to watch:** #rehearsal-social (cards + notifications), the ops channel (failure alerts), Render
  service logs, Supabase `draft_records`/`library_posts`, Postiz dashboard, the live LinkedIn/X/IG pages.
- **Record results** by ticking the checkbox and noting date + anything odd. A ❌ with a screenshot/paste of
  the actual Slack output is the most useful bug report.

### Safety rules for live-publish tests (Suite D/E)
1. Real publishes use **real, intended content** — a glossary LinkedIn card or the Karnataka X post — so a
   "test" is actually a scheduled piece of content shipping. Nothing throwaway goes to the brand pages.
2. The **content-level double-post guard is one-way**: once a library post publishes to a platform, it
   cannot be published there again (by design). Plan which post each test consumes.
3. X **thread** shape can be verified risk-free via Postiz **drafts**: `pnpm --filter @rss/slack-bot
   complete-test` creates one complete draft per platform (never publishes) — inspect in Postiz, then
   delete the drafts.
4. After a session: check Postiz for stray drafts; check `draft_records` for rows stuck in `publishing`.

### Known limitations — do NOT file as bugs
- **Edit / Make brand-ideal refuse on X thread posts** (by design — publish ships the tweets, not the
  caption; per-tweet editing isn't built). Fix thread content in the source library post.
- **IG calendar posts have no images yet** (carousel art is design work) → correctly publish-blocked.
- **Alt text is not sent to Postiz** — their public API has no alt-text field; it still powers card previews.
- **Schedule is allowed** on image-missing / data-slot posts — the worker refuses at fire time with an alert
  (deliberate: schedule first, fix media before the slot).
- The validator/refiner are LLMs: outputs are strongly constrained but not byte-identical run to run.

---

## Suite A — Automated (continuous, every push) 🤖
| # | Test | Expected | Status |
|---|---|---|---|
| A1 | CI on push/PR (`.github/workflows/ci.yml`) | secret-scan + typecheck + 11 unit tests all green; a red ❌ blocks nothing technically (autoDeploy still ships) → treat any red CI as **stop and fix** | ✅ 2026-06-04 |
| A2 | Unit suite locally: `pnpm test` | 11/11 — approval gate, idempotency, double-post guard, retry policy backoff (2m/5m/15m→null), data-slot detection, CTA composition, banned phrases | ✅ 2026-06-04 |
| A3 | `bash scripts/secret-scan.sh` | "Secret scan passed" | ✅ 2026-06-04 |

## Suite B — Production smoke (~5 min, publishes nothing)
| # | Who | Test | Expected | Status |
|---|---|---|---|---|
| B1 | 🧑 | `/posts` in #rehearsal-social | List of 26 posts; glossary entries show NO `⚠️ needs image`; IG/thread entries show their flags | ☐ |
| B2 | 🧑 | Type a plain message (no tag): "what's in the queue?" | Hermes replies in plain text (no `*asterisks*`), under ~4 sentences | ☐ |
| B3 | 🧑 | Select a glossary post (e.g. "Network Effect · Glossary") | Review card with **inline image** above the meta line; buttons: Approve / Edit / Re-evaluate / ✨ Make brand-ideal / Schedule / **Publish → LinkedIn** / Adapt for X | ☐ |
| B4 | 🤖 | Backend smoke (DB rows, storage HTTP 200, Postiz 200 + 3 channels) | All green | ✅ 2026-06-04 |
| B5 | 🧑 | Render dashboard | Both services "Deploy live", logs show bot Socket Mode connected + worker polling 30s | ☐ |

## Suite C — Review-card flows (safe — nothing publishes)
| # | Who | Test | Expected | Status |
|---|---|---|---|---|
| C1 | 🧑 | Library card button set | Library posts show NO Refine/Regenerate (nothing is generated); platform-correct publish button only | ☐ |
| C2 | 🧑 | ✏️ Edit a non-thread post → change a word → Save | Card reposts with `✏️ manually edited`; new text shown | ☐ |
| C3 | 🧑 | ✨ Make brand-ideal on a LinkedIn glossary card | "Refining…" → updated card: ends "Practice this in Rehearsal." (period), ≤3 approved hashtags, no em dashes, no coaching close; every real number from the source preserved | ☐ |
| C4 | 🧑 | Data-slot path: refine an evidence-hungry post (e.g. the adapted "Why MBA" LinkedIn draft) | If a `[[DATA: …]]` slot appears: warning message, card shows `🔢 Has an unfilled [[DATA…]]` note, **Publish button hidden**. Edit a real number in → Publish returns | ☐ |
| C5 | 🧑 | 🔎 Re-evaluate the tight IG "47,328" caption | `✅ APPROVE` with **short bullets** (no wall of text); reasoning says the slides carry the payload — it must NOT demand the reveal in the caption | ☐ |
| C6 | 🧑 | 🔁 Adapt an X post → LinkedIn (try the Paytm thread) | New LinkedIn card: rewritten (not copied), **no 🧵 thread badge**, **no bogus "needs image" block**, LinkedIn-appropriate length | ☐ |
| C7 | 🧑 | Thread guards: ✏️ Edit and ✨ Make brand-ideal on "XFRI — Paytm thread" | Both refuse with the explanation that X publishes the tweets, not the caption | ☐ |
| C8 | 🧑 | Media-required: open an IG post / "XSUN — Mock #893" | `🖼️ Needs an image to publish` note; NO publish button; Schedule still offered | ☐ |
| C9 | 🧑 | Chat thread continuation: reply in a thread Hermes is in, no tag | Hermes answers; top-level untagged channel chatter gets no reply | ☐ |
| C10 | 🧑 | Hashtag variety: ✨ refine two posts with different topics | Different, on-topic hashtag sets (not the same stock trio); LinkedIn ≤3 | ☐ |
| C11 | 🧑 | Approver gate (needs a second account or unset list check): non-approver clicks Publish/Approve/Schedule | `⛔ … isn't on the approver allowlist` — **only meaningful once `SLACK_APPROVERS` is set in Render** | ☐ |

## Suite D — Publish paths (REAL accounts — use intended content)
| # | Who | Test | Expected | Status |
|---|---|---|---|---|
| D1 | 🧑 | Publish a glossary card → LinkedIn (real content, meant to ship) | `🚀 Published … external id: …`; post appears on the GradelessAI page **with the designed image**; `draft_records.externalIds.linkedin` set, status `published` (🤖 verifies) | ☐ |
| D2 | 🧑 | Re-click Publish on the same card | `external id: (skipped/idempotent)` — **no second post** on LinkedIn | ☐ |
| D3 | 🧑 | `/posts` → re-pick the SAME glossary post → Publish | `🛑 … was already published to linkedin … Not re-publishing` | ☐ |
| D4 | 🧑 | Open an X post's card | Only **Publish → X** offered (no LinkedIn button) — routing guard | ☐ |
| D5 | 🧑 | Publish "XMON — Karnataka" → X (text-native, the designated X test) | Tweet appears on @Rehearsal; externalIds.x recorded | ☐ |
| D6 | 🤖/🧑 | X **thread** shape via Postiz drafts: `pnpm --filter @rss/slack-bot complete-test` | 3 drafts in Postiz: LinkedIn caption+image, X = **8 separate tweets** + lead image, IG caption+image with `post_type: post`; inspect, then **delete the drafts** | ✅ 2026-06-04 |
| D7 | 🧑 | IG publish | Blocked until an IG post has an image (correct). Unlocks the moment one does (e.g. if IG glossary versions are seeded) — then: publish, confirm on tryrehearsal.ai feed | ☐ |

## Suite E — Scheduling & worker (the unattended core)
> Use real content; each consumes a post per platform (double-post guard). E1+E2 are the long-pending
> deploy-verification tests.

| # | Who | Test | Expected | Status |
|---|---|---|---|---|
| E1 | 🧑 | Schedule a post +15 min (🗓️ → pick time) | `🗓️ … scheduled for …`; at/just after the slot the worker publishes: `🚀 Scheduled post … published`; post live; externalId recorded | ☐ |
| E2 | 🧑 | Schedule +15 min, then **manually restart `rss-worker`** in Render BEFORE it fires | After restart the worker picks it up from Supabase and publishes **exactly once** | ☐ |
| E3 | 🧑 | Restart the worker again AFTER it published | No duplicate (status `published` + externalIds short-circuit) | ☐ |
| E4 | 🧑+🤖 | **Retry/backoff chaos test:** schedule a post; before it fires, set `POSTIZ_API_URL=https://10.255.255.1` in Render env (worker redeploys); let attempt 1 fail | Ops alert: `⚠️ … failed (attempt 1): … Retrying in ~2 min`; restore the real URL; a later attempt succeeds: `🚀 Scheduled post … published`. Confirms blips never silently kill a post | ☐ |
| E5 | 🧑 | Permanent-failure path: schedule an X post with `POSTIZ_INTEGRATION_X` temporarily blanked | Immediate `⛔ … blocked (won't retry — fix config/approval and reschedule)`; NO retry spam; restore env after | ☐ |
| E6 | 🧑 | Schedule a post that still has a `[[DATA: …]]` slot | At fire time: `🛑 … not published — it still has an unfilled [[DATA…]]` + ops alert; status `failed` | ☐ |
| E7 | 🧑 | Schedule an image-required post with no image | At fire time: `🛑 … needs an image (image-essential) … Add the image and reschedule` | ☐ |
| E8 | 🧑 | Exhausted retries: leave E4's bad URL in place through all 3 attempts (~22 min) | Alerts at each attempt, then `⛔ … failed after 3 attempts — giving up` and it STOPS (no infinite retry) | ☐ |

## Suite F — Resilience & ops
| # | Who | Test | Expected | Status |
|---|---|---|---|---|
| F1 | 🧑 | Restart `rss-bot` in Render | Reconnects (Socket Mode); `/posts` works; existing cards' buttons still work (sessions live in Supabase, not memory) | ☐ |
| F2 | 🤖 | CI catches a broken push: open a PR with a deliberate type error | CI run goes **red** on the PR (and nothing deploys — autoDeploy is main-only) | ✅ 2026-06-04 |
| F3 | 🤖 | Secret scan catches a leak: locally add a fake Slack token (`xoxb-` followed by ~20 digits — not written out here, it would trip the scanner on this very file) to a tracked file, run the scan (do NOT commit) | Scan FAILS naming the file; revert. _Meta-proof: while writing this plan the literal example token DID trip the scan — it works._ | ✅ 2026-06-04 |
| F4 | 🧑 | Rollback drill (knowledge check): Render → service → previous deploy → "Redeploy" | Owner knows the 2-click rollback path before ever needing it | ☐ |
| F5 | 🤖 | Data hygiene query: no `draft_records` stuck in `publishing` (crash artifact), no `scheduled` rows missing `approved_by` | Clean (or flagged for manual fix) | ✅ 2026-06-04 |

---

## Suggested sessions
- **Session 1 (30 min, safe):** B1–B5, all of C. No risk, exercises every new feature.
- **Session 2 (45 min, real posts):** D1–D6 + E1 (the +15-min schedule) + E2/E3 restarts. Closes the
  long-pending deploy verification.
- **Session 3 (60 min, chaos):** E4–E8 + F1–F5. Proves the Phase-A hardening against real failure.

## Standing bug-report format (what to paste in chat)
1. The suite/test id (e.g. "C4 failed").
2. The exact Slack output (copy the message text).
3. What you expected instead.
That's been the highest-signal loop so far — it's how the IG verdict, missing images, and thread bugs were found.
