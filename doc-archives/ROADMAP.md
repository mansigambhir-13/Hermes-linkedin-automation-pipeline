# Gap remediation roadmap

From the 2026-06-03 audit. Ordered so the **text-only deploy ships now** and each later phase unlocks more without blocking the last. Legend: 🧑 owner action · 🤖 I can build it.

---

## Phase 0 — at deploy (nothing blocks the text-only go-live)
| Item | Who | Status |
|---|---|---|
| `SLACK_APPROVERS` = `U0ASFP782BS` (your ID) — governance gate | 🧑/🤖 | ✅ set locally; **add the same value in Render's secret** |
| Render region = **Singapore** (closest to Tokyo Supabase) | 🧑 | ✅ already pinned in `render.yaml` — just confirm at Apply |
| Rotate dev-exposed keys; enter fresh values in Render | 🧑 | pending |
| Delete the wrong-platform LinkedIn post (GradelessAI) | 🧑 | pending |
| Graceful `/draft` guard (no FAL key → point to `/posts`) | 🤖 | ✅ shipped (`1374a08`) |

**Outcome:** text-only LinkedIn + X publishing live on Render, approver-gated.

---

## Phase 1 — 🔴 Image portability (unlocks images + Instagram) · ~built, gated on 1 key · 🤖
The one architectural gap. Today images were absolute local paths → break on Render. **Now on Supabase Storage** (S3 dropped).
- ✅ Public bucket `post-media` created.
- ✅ `SupabaseObjectStore` built (`@rss/core` objectStore; raw REST, permanent public URLs, no presign/expiry). `OBJECT_STORE=supabase`.
- ✅ `seed-library` uploads each local PNG → stores the **portable storage key** in `image_key` (text-only posts upload nothing).
- ✅ Publish path: `mintUrl(key)` → permanent public URL → Postiz uploads from it (already supported). Works on any machine, scheduled or live.
- ⏳ **Needs `SUPABASE_SERVICE_ROLE_KEY`** (Supabase → Settings → API → service_role) to actually upload media. Text-only deploy needs nothing.
- ⏳ **Verify** once the key lands + an image post exists: seed → publish → image renders on LinkedIn. (Card inline-preview for DB-backed images is a small follow-up — uses the public URL as a Slack image block.)
**Unblocks:** IG (mandates media), any LinkedIn/X image post, `/draft` output.

---

## Phase 2 — 🟠 Correctness hardening · ~half day · 🤖
1. **Content-level double-post guard.** Dedup on `library-post-id + platform`: before publish, check `draft_records` for a prior `published` record from the same library source+platform; warn/skip on repeat. (Today idempotency is per-card only.)
2. **Tests for the v1 code** (currently zero): `contentLibrary` parser (both MD formats + blockquote extraction), `platformSignals`, `draftFromLibrary`, `sanitizeCaption`/`toSlackPlain`, `requireEnv`. Mock Anthropic for `validatePost`/`adaptCaption`.
3. **(Optional) Fully enable `/draft`** if you want generation: add `FAL_API_KEY` + a real `config/locked-config.json` to Render.

---

## Phase 3 — 🟡 Ops & content intake · ongoing · 🤖 + 🧑
1. **Automated weekly intake.** A small admin path so new finished posts land in `library_posts` without a local machine: a Render **Cron Job** running `seed-library` against a synced content source (a content git repo, or a Google Sheet reader), images → storage (Phase 1).
2. **Monitoring.** Set `SLACK_OPS_CHANNEL`; add a worker heartbeat (daily "alive" ping + on-error alerts). Optional external uptime check.
3. **Restart policy.** Decide: bot **exits** on fatal so Render restarts cleanly (vs current keep-alive). Small change; trade crash-loop risk for self-heal on a true hang.

---

## Phase 4 — 🟢 Hygiene · low priority · 🤖
1. **Postiz rate-limit backoff** in the worker (throttle per-tick publishes; ~100/hr cap).
2. **Health visibility** — `/health` is unreachable on a Background Worker; rely on log-based checks, or switch the bot to a Render Web Service if external health is wanted.
3. Periodic dependency + token-refresh review.

---

### Recommended sequence
**Deploy now (Phase 0) → Phase 1 before the next image/IG content → Phase 2 alongside → Phase 3 as cadence grows → Phase 4 anytime.**
The only thing that should gate *new content with images* is Phase 1.
