# Rehearsal — Social Posting Guidelines (via the Slack studio)

How we regulate what goes out on LinkedIn & Instagram through the `@hermes` Slack bot. These rules combine
**system-enforced guardrails** (the pipeline blocks the violation) with **human policy** (the team must
follow). The governing principle: **a machine drafts, a human decides — nothing reaches a real account
without an explicit human approval.**

---

## 1. Roles (who does what)

| Role | Who | Can |
|------|-----|-----|
| **Requester** | Any marketer | Run `/draft …`, Edit, Refine, Regenerate — i.e. *propose* content. |
| **Reviewer / Approver** | Social Media Manager (the post owner) | Review against the checklist (§4), **Approve**, **Schedule**, **Publish**. |
| **Admin** | Eng / owner | Holds tokens, scopes, locked-config, publish credentials; runs the bot. |

**Two-key rule (recommended):** the person who *drafts* a post should not be the only one who *publishes*
it. For anything going to a company account, a Reviewer other than the Requester clicks Approve → Publish.

---

## 2. The standard operating procedure (in Slack)

1. **Draft** — `/draft [linkedin|instagram] [single|carousel] <idea>`. The bot returns a review card:
   hook + full caption + the generated image(s).
2. **Review** — the Reviewer runs the §4 checklist on the card.
3. **Refine** — not right yet? Use:
   - **✏️ Edit** — fix wording by hand (small copy tweaks, typo, a number).
   - **💬 Refine** — give an instruction ("punchier; lead with the CV angle; cut the metaphor") → re-draft.
   - **🔄 Regenerate** — a fresh take on the same idea (new hook + image).
   Iterate until it clears the bar. There is **no limit** on refine loops — burning a few drafts is cheap;
   posting a weak one is not.
4. **Approve** — **✅ Approve** records who signed off. *Approve is not publish.*
5. **Ship** — **🚀 Publish** (now) or **🗓️ Schedule** (later). Publishing is the only step that touches a
   real account, and it requires the approval from step 4.

> Keep the whole loop **in one Slack channel/thread** so the draft, every revision, the approver, and the
> publish result are one auditable record.

---

## 3. Hard guardrails (the system enforces these — you can't post around them)

- **No auto-publish.** Every publish needs an explicit human approver (`approved_by`); the pipeline refuses
  otherwise. Auto-ideas and drafts *propose* only — they never publish.
- **The model never writes the CTA or hashtags.** They are appended deterministically from
  `config/locked-config.json`. If the card shows `⚠️ CTA/hashtags stubbed (provisional)`, the locked config
  isn't loaded yet — **do not publish**; treat the caption as draft-only until it shows `✅ applied`.
- **Banned-phrase block.** Marketing clichés ("game-changer", "unlock your potential", "supercharge",
  hype-stacks, fake urgency) are flagged on the card (`🚫 banned: …`). A flagged draft is **not approvable**
  — Refine or Edit it out first.
- **No em dashes.** Posts must contain NO em dashes (—) or en dashes (–) — they read as machine-generated and
  are off-voice. The publish path auto-rewrites them to commas before posting (`sanitizeCaption`), and the
  validator reports `no-emdash ✗` when the source had any. Prefer commas, periods, or a restructured sentence.
- **Idempotency.** Publishing the same post to the same platform twice is a no-op (returns the original
  post id) — you can't accidentally double-post.
- **Platform integrity.** Instagram requires public image URLs + a passed Meta app review; LinkedIn
  requires an authorized OAuth target. Until those land, Publish returns a clear *blocked* message rather
  than a fake success.

---

## 4. Reviewer checklist (run before Approve)

**Caption**
- [ ] **On-brand voice** — sharp, specific, a little provocative; sounds like Rehearsal, not generic edtech.
- [ ] **Fresh angle** — it's an original hook, not a rehashed brief (originality is a hard brand rule).
- [ ] **Claims are true** — any number or named fact (e.g. "297 mock interviews", company names, "%"
      figures) is real and defensible. **Invented stats do not ship.**
- [ ] **No banned phrases / no emoji walls / no fake urgency / no em dashes (—).**
- [ ] **CTA + hashtags** are the locked, correct set for the platform (card shows `✅ applied`).
- [ ] **Length & shape** fit the platform (LinkedIn longer-form; Instagram tighter).

**Visual**
- [ ] **On-brand** — dark canvas, the gradient on one focal element, editorial (not literal stock).
- [ ] **On-topic** — the image matches the post's idea.
- [ ] **Text is clean** — any in-image text is legible and correctly spelled (no garbled AI text). If it's
      garbled, Regenerate or drop to a no-text editorial image.
- [ ] **Carousel** — slides read as one consistent set (≥ ~70% cohesion) and tell the story in order.

**Safety / compliance**
- [ ] No student PII, no private data, no real candidate names or results.
- [ ] No claims that promise outcomes ("guaranteed placement/offer").
- [ ] Nothing that targets or names an individual; nothing legally/clinically sensitive.
- [ ] Respects each platform's content policy.

If any box fails → **Refine/Edit/Regenerate**, don't Approve.

---

## 5. Publishing & scheduling rules

- **Approve → then Publish/Schedule.** Don't click Publish on an un-reviewed card.
- **Company accounts** require the two-key rule (§1). Personal/test accounts can be single-approver.
- **Scheduling:** all times are **IST**. Default lead time ≥ 1 hour. Prefer business-day daytime slots;
  avoid late-night sends. Treat exam/result days and placement-season peaks deliberately (see §6).
- **Scheduled ≠ sent:** the bot records the scheduled time; the worker/cron fires it. A scheduled post is
  still subject to a last-look — cancel if circumstances change.
- **One platform per draft.** Cross-posting the *same* art/words to LinkedIn and Instagram needs a separate
  reviewed draft each (different aspect ratios, different copy length).

---

## 6. Cadence, volume & calendar

- Start conservative: **2–3 LinkedIn + 2–3 Instagram per week**; raise only if quality holds.
- **Don't queue-empty the idea list** — fresh, in-territory ideas beat volume.
- **Placement-season aware:** lean into summers/finals/GD-PI windows; ease off during exam blackout days.
- No more than one post per platform per day without a reason.

---

## 7. Stop / fix / escalate

- **Stop a draft:** just don't Approve it — drafts never go anywhere on their own.
- **Stop the whole bot (kill switch):** Admin stops the bot process; with it down, nothing can publish.
- **A bad post went live:** delete it on the platform immediately, post a note in the ops channel with the
  post id, and log what happened. The publish record (who/when/what) is the starting point.
- **Repeated bad drafts** (off-brand, garbled images): flag to Admin — may need a prompt/brand-spec or model
  adjustment, not more retries.

---

## 8. Record & audit

- The Slack thread is the human record: draft → revisions → approver → publish result.
- The **system of record is Supabase** (once `DATABASE_URL` is connected): post, status, and `publish_log`
  (platform, external id, who approved, success/failure). Until then, sessions are in-memory — treat the
  Slack thread as the source of truth and don't rely on the bot surviving a restart.

---

## Current status of the controls (keep this honest)

| Control | State |
|---|---|
| Human approval before publish | ✅ enforced |
| Banned-phrase flagging | ✅ enforced |
| Locked CTA/hashtags appended by code | ⚠️ **provisional** — needs `config/locked-config.json` (real CTA + hashtags) |
| Persisted audit trail (Supabase) | ⚠️ pending `DATABASE_URL` (in-memory for now) |
| LinkedIn publishing | ⛔ gated on OAuth target + token |
| Instagram publishing | ⛔ gated on Meta app review + public image URLs |
| Scheduling fires automatically | ⛔ records intent; worker/cron not yet running |

These are the items that turn the guidelines from "followed by convention" into "enforced by the system."
See `BLOCKERS.md` for owners.
