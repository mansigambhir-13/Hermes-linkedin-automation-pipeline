# Rehearsal — mailers

## 2. Voice Notes consumer mailer (prospects + win-back)

`rehearsal-voice-notes-mailer.html` — announces the Voice Notes feature to app users
and prospects. Hero: `../banner-notes.png` ("Talk. We take notes."). Body: 4 feature
bullets (one-tap record, self-organizing library, in-course capture, ask-your-notes),
a Tap·Talk·Saved strip of 3 real app screenshots (`assets/notes-*.jpeg`), win-back
line, green CTA "Record your first note". Preview: `_preview-notes.png`.

Replacements before sending: `{{BANNER_URL}}`, `{{IMG_HOME}}`, `{{IMG_PICKER}}`,
`{{IMG_SAVED}}` (upload the 3 files in `assets/` + the banner to your ESP/CDN),
`{{FirstName}}`, `{{UnsubscribeURL}}` + footer address.

Subject options (poster-voice):
- Notes that talk back.
- Save it. Sound like you said it.
- What you save, you know.
- Your best thinking happens out loud

Alt hero: `../banner-notes-saidit.png` ("Save it. Sound like you said it.") for A/B.

# 1. Rehearsal × Jaipuria — admissions mailer

A full, ready-to-send HTML email built from the Day-1 admissions copy + the
`banner-edge.png` header. Rehearsal-branded, "in partnership with Jaipuria".

```
mailer/
├── rehearsal-jaipuria-mailer.html   ← the template (paste into your ESP)
├── _preview.png                     ← what it looks like (banner + body)
└── _preview.html                    ← local preview (banner wired to ../banner-edge.png)
```

## Before you send — 3 replacements

1. **`{{BANNER_URL}}`** — upload `../banner-edge.png` to your ESP's image host (or any
   CDN) and paste the public URL. Email clients can't read local files.
2. **`{{FirstName}}`** — swap for your ESP's merge tag:
   - Mailchimp `*|FNAME|*` · Brevo/Sendinblue `{{contact.FIRSTNAME}}` · Zoho `${FirstName}`
3. **Footer** — fill the company address + wire `{{UnsubscribeURL}}` (legally required for
   bulk mail; most ESPs auto-inject their own — use that tag).

## Subject line options (pick one, A/B test two)

- Rehearse for months. Not the night before.
- {{FirstName}}, the unfair advantage your placement season needs
- From Day 1: the AI prep that knows your CV
- Most colleges promise placements. Jaipuria builds the hire.

**Preheader** (already in the HTML, edit if you change subject):
> While peers cram the night before, you'll have rehearsed for months. Free AI interview prep, from Day 1. Batch starts 29 June.

## How to send

- **ESP (Mailchimp / Brevo / Zoho / Mailerlite):** new campaign → "code your own / paste HTML"
  → paste `rehearsal-jaipuria-mailer.html` → upload banner, set merge tag → send test to
  yourself → check on phone + Gmail + Outlook → schedule.
- **Gmail / Outlook directly:** not recommended for bulk (no merge tags, spam risk). Use an ESP.

## Tech notes

- 600px width, table layout, inline CSS, bulletproof VML button for Outlook, web-safe
  font stack (Raleway enhances where supported). Tested-safe pattern for Gmail, Apple
  Mail, Outlook, and mobile.
- To re-preview after edits:
  ```bash
  cd postizz/email/mailer
  B="file://$PWD/../banner-edge.png"
  sed -e "s|{{BANNER_URL}}|$B|g" -e "s|{{FirstName}}|Aarav|g" rehearsal-jaipuria-mailer.html > _preview.html
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=640,1500 \
    --screenshot=_preview.png "file://$PWD/_preview.html"
  ```
- Swap headline banner: change `banner-edge.png` to `banner-hireable` / `banner-think` /
  `banner-light` (from `../`) for a different hero.
