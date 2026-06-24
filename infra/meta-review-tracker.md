# Meta / Instagram App Review — Critical Path Tracker

**Longest lead-time item (~2–4 weeks). Instagram publishing CANNOT go live until review clears.**
Code can't do any of this — a **named human with Business-account admin access** must. If only one thing starts today, it's this.

- **Owner:** `<<NAME — assign TODAY>>`
- **Started:** `<<DATE>>`
- **Status:** ⛔ not started

## Steps (human)
- [ ] Convert the Rehearsal Instagram account to a **Professional (Business/Creator)** account
- [ ] Create/confirm a **Facebook Page** and link the IG account to it
- [ ] Create a **Meta developer app**
- [ ] Request the **content-publishing permission** (`instagram_content_publish` + related scopes)
- [ ] Submit for **App Review**
- [ ] On approval, record: app ID, IG user ID, long-lived token refresh plan → AWS Secrets Manager

## What the code already assumes (so activation is flip-a-switch — Phase 5)
- Publisher implements the IG two-step container→publish flow + carousel child→parent (06-system-design §B5).
- Pre-publish **preconditions fail fast with a clear message** until review is PASSED (06 §B5/§B10).
- Images served at **fresh public/presigned S3 URLs at publish time**.
- App-side **100-publishes / 24h** rate-limit counter.
