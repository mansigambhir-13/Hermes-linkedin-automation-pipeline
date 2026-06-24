# Rehearsal Social Studio — Go-Live Playbook (owner actions)

> ⚠️ **OBSOLETE — kept for archaeology.** This predates the Postiz + Render + Supabase pivot. Postiz now
> owns all publishing OAuth (so there is **no Meta app review** and no LinkedIn OAuth step), S3 was dropped
> for Supabase Storage, and the system is deployed on Render. For the current process use:
> **[`RENDER.md`](RENDER.md)** (deploy), **[`SECURITY.md`](SECURITY.md)** (security + owner checklist),
> **[`OPERATING.md`](OPERATING.md)** (day-to-day). Ignore the S3 / Meta / LinkedIn-OAuth sections below.

Everything code-buildable is built (P1 Durability, P2 Supabase, P3 publishing code, P5 robustness — all
typecheck + tests green). The only things between here and live posts are the eight items below — and they
can only be done by the owner. Order matters: **Meta app review is the 2–4 week long pole, start it today.**

```
TIME (start → live)
─────────────────────────────────────────────────────────────────────
 Day 0 ─┬─── Meta app review submission ──── ~2–4 wks ──┐
        ├─── LinkedIn app + OAuth (~1 hr) ──────────────┤
        ├─── S3 bucket + IAM (15 min) ──────────────────┼─→ FIRST REAL POST
        ├─── Supabase + DATABASE_URL (5 min) ───────────┤    (LinkedIn first; IG after Meta approves)
        └─── locked-config.json + guidelines ───────────┘
 Then ──── Key rotation + deploy host decision ────────→ PRODUCTION
```

---

## 1. Meta app review — Instagram (start TODAY, it's the long pole)

**Why:** without Meta's approval of `instagram_content_publish`, Instagram never publishes to anyone outside
your own test account. Typical lead: **2–4 weeks**. Submitting today shortens every other timeline.

### Prereqs
- An **Instagram Professional** account (Business or Creator — convert in IG app → Settings → Account type).
- A **Facebook Page** linked to that IG account (IG Settings → Account Centre → Accounts → connect to a Page).
- A **Meta Business Account** (recommended) wrapping both. (business.facebook.com)

### Steps
1. Go to **<https://developers.facebook.com>** → My Apps → **Create App**.
   - Use case: **Other** → Type: **Business** → App name e.g. `Rehearsal Social Studio`.
2. App Dashboard → **Add products** → add **Instagram** (the unified product; older consoles split it into
   "Instagram Basic Display" + "Instagram Graph API" — add the **Graph API** one).
3. Connect your Facebook Page (and through it the IG Pro account) in the Instagram product setup.
4. **Get the IG Business Account ID** (this becomes `IG_USER_ID`):
   - Open **Graph API Explorer** → <https://developers.facebook.com/tools/explorer>.
   - Generate a User Access Token with `pages_show_list` + `pages_read_engagement` + `instagram_basic`.
   - `GET /me/accounts` → find your Page → note its `id`.
   - `GET /{page-id}?fields=instagram_business_account` → response includes `instagram_business_account.id`
     → that's your `IG_USER_ID`. Paste into `.env`.
5. **Get a long-lived token** (short-lived tokens last ~1 hr; long-lived ~60 d):
   - Settings → Basic → copy **App ID** and **App Secret** → `.env` as `META_APP_ID` + `META_APP_SECRET`.
   - In Graph API Explorer, generate a user token with the permissions in step 6 → copy.
   - Exchange for long-lived:
     ```bash
     curl "https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$META_APP_ID&client_secret=$META_APP_SECRET&fb_exchange_token=$SHORT_TOKEN"
     ```
   - Copy `access_token` → `.env` as `META_ACCESS_TOKEN`.
   - From then on: `pnpm --filter @rss/publisher refresh-tokens meta` (weekly cron) keeps it alive.
6. **Request these permissions** (App Review → Permissions and Features):
   - `instagram_basic` — read the IG account.
   - **`instagram_content_publish`** — the publish gate. *This is the one that needs review.*
   - `pages_show_list` — list managed Pages.
   - `pages_read_engagement` — read Page info.
   - (Optional) `business_management` if you manage via Business Manager.
7. **Submit for App Review**:
   - **Screencast:** record `/draft instagram single <idea>` in Slack → Approve → Publish → the post landing
     on your test IG. (Use Development mode for this — it works on your own accounts without review.)
   - **Use-case description** (paste this, edit names):
     > Rehearsal Social Studio is an internal tool for our brand (Rehearsal — an AI interview-prep platform).
     > It auto-drafts on-brand captions and images, a human reviewer approves each post in Slack, and only then
     > publishes to our **own** Instagram Business account. No third-party accounts; no end-user input. Required
     > permission: `instagram_content_publish` — to publish the human-approved post to our IG Business account.
   - Submit → wait. Typical 2–4 weeks; can be faster if the screencast + description are clear.
8. **During review (Development mode):** you can already publish to your **own** test IG account (any IG Pro
   account where your user is an admin/developer/tester on the app). Use this to verify the pipeline now.

### Artifacts → `.env`
`IG_USER_ID`, `META_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`.

### Verify
- `pnpm --filter @rss/publisher refresh-tokens meta` → writes a new long-lived token to `.env`.
- In Slack: `/draft instagram single a test post` → Approve → Publish → real IG post (own account during
  review; any approved account once `instagram_content_publish` is granted).

---

## 2. LinkedIn app + OAuth (~1 hour)

**Why:** to get the access token + author URN that let the bot post to a person's feed or a company page.

### Decision before you start
**Post as a personal profile or a company page?**

| | Personal | Company page |
|---|---|---|
| Scopes needed | `w_member_social` | `w_organization_social` (+ `r_organization_social`) |
| Admin | none | you must be a Page admin |
| App approval | "Share on LinkedIn" (standard) | **"Marketing Developer Platform"** or **"Community Management API"** — review process |
| Use | safe for v1 testing | what you actually want for brand posting |

Pick one. Two notes if company: you must be a Page admin **and** verify the app's association with that page.

### Steps
1. **<https://developer.linkedin.com>** → **Create app**.
   - Name, logo, **App association**: type your company page name (for company posting), or any page you
     administer (for personal-only).
   - **Verify the association** — LinkedIn emails the page's admins a verification link; click it from the
     admin LinkedIn account. The app stays unverified until you do this.
2. **Auth tab → OAuth 2.0 settings → Authorized redirect URLs**: add `http://localhost:3003/oauth/callback`
   (we'll use this for the one-time auth flow).
3. **Auth tab → Application credentials**: copy **Client ID** and **Client Secret** → `.env` as
   `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`.
4. **Products tab → request access** to:
   - **Sign In with LinkedIn using OpenID Connect** (gives `openid profile email`).
   - **Share on LinkedIn** (gives `w_member_social` — personal posting).
   - For company posting: **Community Management API** or **Marketing Developer Platform** — submit a
     short description (reuse the Meta one above).
5. **Run the OAuth flow once** to get tokens.
   - **Easy path (recommended)** — once `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` are in `.env`, just run:
     ```bash
     pnpm --filter @rss/publisher linkedin-oauth
     ```
     This opens the browser to the authorize URL, captures the callback on `http://localhost:3003/oauth/callback`,
     exchanges the code, and **writes `LINKEDIN_ACCESS_TOKEN` (+ `LINKEDIN_REFRESH_TOKEN` if issued) into `.env` in
     place** — no copy-paste, no token echoed in stdout. Override port/scopes via `LINKEDIN_OAUTH_PORT` /
     `LINKEDIN_OAUTH_SCOPES`.
   - **Manual fallback** (if you can't run the script): paste in the browser, substituting `YOUR_CLIENT_ID`:
     ```
     https://www.linkedin.com/oauth/v2/authorization
       ?response_type=code
       &client_id=YOUR_CLIENT_ID
       &redirect_uri=http%3A%2F%2Flocalhost%3A3003%2Foauth%2Fcallback
       &scope=openid%20profile%20email%20w_member_social%20w_organization_social%20r_organization_social
       &state=anyrandom
     ```
     (Drop the `w_organization_*` scopes if you're personal-only.)
   - Approve → LinkedIn redirects to `http://localhost:3003/oauth/callback?code=…&state=…`. The browser will
     fail to load (nothing's listening on 3003) — that's fine, **copy the `code` from the URL bar**.
   - **Exchange the code for tokens** (one curl):
     ```bash
     curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
       -d 'grant_type=authorization_code' \
       -d 'code=THE_CODE_FROM_THE_REDIRECT' \
       -d 'redirect_uri=http://localhost:3003/oauth/callback' \
       -d 'client_id=YOUR_CLIENT_ID' \
       -d 'client_secret=YOUR_CLIENT_SECRET'
     ```
   - Response includes `access_token`, `expires_in`, and (if your product/scope set is approved for refresh)
     `refresh_token`, `refresh_token_expires_in`.
   - Paste `access_token` → `.env` `LINKEDIN_ACCESS_TOKEN`; `refresh_token` → `LINKEDIN_REFRESH_TOKEN`.
   - **Refresh-token caveat:** LinkedIn issues refresh tokens to apps approved for them. If yours doesn't come
     back, you'll need to re-run this flow when the token expires (~60 d). With a refresh token,
     `pnpm --filter @rss/publisher refresh-tokens linkedin` keeps you alive — cron it weekly.
6. **Get the author URN** (where posts go).
   - **Personal:**
     ```bash
     curl -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" https://api.linkedin.com/v2/userinfo
     ```
     The `sub` field is your member id. URN = `urn:li:person:<sub>`.
   - **Company:** the URN is `urn:li:organization:<numeric-id>`. If your page URL is
     `linkedin.com/company/<numeric>`, that number is the id. If it's a vanity URL, find the numeric id via
     LinkedIn Page Admin Tools (Page → Admin → "About this page") or via the LinkedIn Marketing API
     (`/rest/organizationAcls?q=roleAssignee` with proper headers).
   - Paste into `.env` `LINKEDIN_AUTHOR_URN`.

### Artifacts → `.env`
`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_REFRESH_TOKEN` (if issued),
`LINKEDIN_AUTHOR_URN`.

### Verify
In Slack: `/draft linkedin single a test post` → Approve → Publish. Bot replies with `🚀 Published … external
id: urn:li:share:…`. Open the LinkedIn page/feed — post is there.

---

## 3. S3 bucket + IAM creds (15 min)

**Why:** Both LinkedIn and Instagram fetch the post's image by URL — local `file://` doesn't work. We use
**presigned URLs**, so the bucket itself can stay private.

### Steps
1. AWS Console → **S3 → Create bucket**. Name e.g. `rehearsal-social-media`, region near you. Keep **Block all
   public access ON** (we don't need public).
2. IAM → **Users → Create user** for programmatic access only. Attach a tight inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject"],
       "Resource": "arn:aws:s3:::rehearsal-social-media/*"
     }]
   }
   ```
3. Create an **access key** for the user → copy the two values.
4. `.env`:
   ```
   OBJECT_STORE=s3
   S3_BUCKET=rehearsal-social-media
   S3_REGION=<your region, e.g. ap-south-1>
   AWS_ACCESS_KEY_ID=<from step 3>
   AWS_SECRET_ACCESS_KEY=<from step 3>
   ```

### Verify
Draft any post in Slack — the generated image now lands in S3 (you'll see it in the bucket). On Publish, the
adapter mints a presigned URL and LinkedIn/IG fetches it without error.

---

## 4. Supabase + `DATABASE_URL` (5 min)

**Why:** durable system of record — drafts/approvals/scheduled times survive restarts, and `publish_log` is
the canonical audit trail.

### Steps
1. **<https://app.supabase.com>** → New project. Pick a region, set a strong DB password.
2. Project Settings → **Database → Connection string → URI**. Use the **Transaction Pooler** URI — our
   `postgres` client runs with `prepare:false` which suits the pooler.
3. `.env`:
   ```
   DATABASE_URL=postgresql://…   ← paste the URI
   DRAFT_STORE=supabase
   ```
4. From the repo root:
   ```bash
   pnpm --filter @rss/core db:migrate    # applies db/0001_init.sql + db/0002_draft_records.sql
   pnpm --filter @rss/core db:check       # lists public tables (confirms it worked)
   ```

### Verify
`db:check` shows `draft_records`, `posts`, `post_images`, `publish_log`, `idea_inbox`, `jobs`. Restart the bot
+ worker — new drafts persist to Supabase (not the local `.data/drafts.json`).

---

## 5. Fill `config/locked-config.json` (the CTA + hashtags)

**Why:** every published caption appends these — the model is *forbidden* from writing them. Until this file
exists, captions show `⚠️ provisional` and would publish without your brand CTA/tags.

```bash
cp config/locked-config.example.json config/locked-config.json
```
Edit:
```json
{
  "cta": {
    "linkedin": "Try Rehearsal — practise real interviews for real companies.",
    "instagram": "Link in bio · Rehearsal"
  },
  "hashtags": {
    "linkedin": ["#MBA", "#Placements", "#GDPI", "#Interviews"],
    "instagram": ["#MBA", "#CAT", "#PlacementPrep", "#Rehearsal"]
  }
}
```
Replace with the **real** CTA + hashtag sets from marketing. No `<<TEAM …>>` placeholders — the loader
explicitly rejects those (one of the unit tests).

### Verify
Draft any post — the review card now shows `✅ CTA/hashtags applied` instead of `⚠️ provisional`.

---

## 6. MBA-prof + marketing voice guidelines

**Where they go:** the agent reads three spec docs at runtime — at the repo root:
- `01-brand-and-voice-spec.md` — voice, banned phrases, examples, the bar.
- `02-image-generation-method.md` — image direction (already grounded via Upgrade C from your real visuals).
- `03-agent-instructions.md` — hard rules (originality, CTA-by-code, structure).

Drop or merge the guidelines into the relevant doc — the next draft picks them up, **no code rework**.
Send them to me and I'll do a clean integration (turn voice rules into specific lines, add banned phrases to
`packages/core/src/bannedPhrases.ts`, etc.).

---

## 7. Deploy host (decide when ready)

Three options — pick one and I'll do the deploy packaging (Phase 6):

| Option | Pros | Cons |
|---|---|---|
| **AWS Fargate / App Runner** | matches your Supabase/S3/Bedrock stack; native Secrets Manager | most setup |
| **One VM + Docker Compose** | simplest single box (bot + worker + intake together) | DIY ops; manual scaling |
| **Vercel + always-on bot host** | Vercel for web + cron; lightweight | the Socket-Mode bot needs a separate always-on host (Vercel functions are serverless) |

---

## 8. Rotate the exposed plaintext keys

These were in `node_modules/.env` at various points → **rotate before any go-live:**

- **Slack bot token** — Slack app dashboard → OAuth → **Reinstall to workspace** (new `xoxb-…`); paste into `.env`.
- **AWS** — IAM → user → create a NEW access key → put it in `.env` → **disable + delete** the old key.
- **fal** — fal.ai dashboard → revoke + create new key → put in `.env`.
- **Old Vercel AI Gateway key** — already retired in code; revoke it in the Vercel dashboard so it can't be used.
- **Delete `node_modules/.env`** for good. Root `.env` is the only place secrets should live (gitignored).
  The recurring `node_modules/.env` is the security smell — don't recreate it.

---

## Do-this-first order (the critical path)

1. **Today:** kick off **Meta app review (§1)** — the 2–4 week clock starts now. In parallel start LinkedIn
   (§2 steps 1–4 take ~15 min).
2. **This week:** finish LinkedIn OAuth (§2 step 5+), set up S3 (§3) + Supabase (§4), fill locked-config (§5),
   send me the voice guidelines (§6).
3. **Pre-go-live:** rotate the keys (§8) and decide a deploy host (§7).

## Tell me when each is done — I'll verify it

| When you've done | Ping me with | I'll do |
|---|---|---|
| Meta token in `.env` | "Meta done" | run a verify Publish to your test IG (development mode) |
| LinkedIn token + URN in `.env` | "LinkedIn done — URN is X" | run a verify Publish |
| `DATABASE_URL` added | "Supabase URL added" | migrate + verify persistence + scheduling round-trip |
| S3 vars set | "S3 wired" | verify image upload + presigned URL fetch |
| `locked-config.json` filled | "locked-config filled" | confirm the caption gate closes |
| Voice guidelines pasted | "guidelines pasted" | clean integration into the spec docs + banned-phrase list |
| Host chosen | "deploying on X" | Dockerfiles + deploy guide for that host |
