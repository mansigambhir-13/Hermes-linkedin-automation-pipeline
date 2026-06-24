# postizz — Rehearsal / Gradeless AI Social & Marketing Content Studio

> **Single source of truth for every piece of marketing creative we ship for the
> Rehearsal app** (a Gradeless AI product, in partnership with Jaipuria Institute
> of Management).
>
> This folder is a **design + content generation workspace**, not an application.
> Every image is rendered the same way: a Python script writes an **HTML file**,
> then **headless Google Chrome screenshots it** to a PNG. There is no Figma, no
> Canva, no design tool — the design system lives in CSS inside the build scripts.
>
> Read this document end-to-end before editing anything. It explains the shared
> brand DNA, every sub-system, the exact visual specs (hex codes, fonts, pixel
> dimensions), the copywriting voice, and how to regenerate and publish.

---

## 0. TL;DR for a new developer

| You want to… | Go to | Run |
|---|---|---|
| Regenerate the app's **industry logo tiles** | [`v2/`](#3-v2--industry-logo-tiles-app) | `python3 _gen_v2.py` |
| Build a **glossary term card** (LinkedIn / IG / WhatsApp) | [`glossary/`](#4-glossary--the-business-glossary-cards) | `python3 linkdn/_build.py <slug>` |
| Build an **MBA jargon** explainer card | [`jargons/`](#5-jargons--mba-jargon-cards) | `python3 _build.py <slug>` |
| Build an **email header banner** / mailer | [`email/`](#6-email--header-banners--mailers) | `python3 _build.py <key>` |
| Build a **poster / standee / hoarding** | [`hoardings/`](#7-hoardings--posters-standees--billboards) | `python3 posters/v1/_build.py <slug>` |

**Hard dependencies for every build:** Python 3, **Google Chrome** at
`/Applications/Google Chrome.app/...` (macOS), an **internet connection** (fonts +
some QR/visual assets load over the network at render time), and Pillow (`pip install Pillow`)
for the `v2/` tile post-processing. Publishing additionally needs `POSTIZ_API_KEY`;
the `v2/` generator needs `FAL_KEY`. All keys live in the **repo root `.env`**.

---

## 1. The shared brand system (applies to EVERYTHING here)

Everything in `postizz/` is built from one visual DNA. If you add a new creative,
it **must** inherit these tokens or it will look off-brand.

### 1.1 Color tokens (exact hex — never approximate)

| Token | Hex | Usage |
|---|---|---|
| **Ink / background (dark)** | `#0a0a0c` | The default canvas. Almost-black with a faint cool tint. |
| **Card surface** | `#141418` / `#131318` / `#15151c` | Raised cards sit slightly lighter than the canvas. |
| **Rainbow gradient** | `linear-gradient(90deg, #9677f8 0%, #4e44fd 33%, #ff4859 66%, #00c483 100%)` | THE brand signature. Used on headlines (as text fill), rules, underlines, the bottom stripe, and tile borders. |
| ↳ lavender | `#9677f8` | gradient stop 1 |
| ↳ indigo | `#4e44fd` | gradient stop 2 |
| ↳ coral | `#ff4859` | gradient stop 3 (also the "marketing" subject accent) |
| ↳ green | `#00c483` | gradient stop 4 **and** the solid CTA-button color |
| **CTA button** | bg `#00c483`, text `#06231a` | The green "Download / Try" pill. Dark-green ink on green. |
| **Body text (on dark)** | `#d6dae1` / `#c9ced6` / `#cfd3da` | Soft off-white, weight 300. |
| **Muted / caption text** | `#8b909b` / `#9aa0ab` / `#b9bdc6` | Sub-labels, partner line. |
| **Bolded name (in body)** | `#ffffff`, weight 700–800 | Person/company names are bolded **white** for scan emphasis. |

A **light** variant exists only for email (`#ffffff` bg, `#0a0a0c` ink, green eyebrow `#00a06b`).

### 1.2 Typography

- **Font family: `Raleway`** (Google Fonts) — loaded via
  `<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;600;700;800;900">`.
  **An internet connection is required at render time** or the font falls back to sans-serif.
- Weight language: **900** = display headlines, **800** = eyebrows / mastheads / CTA,
  **700** = bolded names & labels, **300–400** = body. The wordmark uses **400 "Re" + 200 "hearsal"**.
- Headlines are tight: `letter-spacing` around `-1.5px` to `-5px`, `line-height` ~`0.94–1.0`.
- Eyebrows / mastheads are wide: `letter-spacing` `5–7px`, `text-transform:uppercase`.

### 1.3 Recurring layout elements

- **Wordmark:** `Re` (weight 400) + `hearsal` (weight 200), followed by a short
  rainbow underline rule (`.wmline`, ~150px × 5px).
- **Bottom stripe:** a full-width rainbow bar (`.stripe`, 7–12px) pinned to the bottom of every canvas.
- **Grain overlay:** a 1px radial-dot pattern at ~2–4% opacity (`.grain`) for texture on dark surfaces.
- **Radial glow:** a soft green (or lavender→coral) radial-gradient bloom behind the content (`.glow`).
- **Green CTA pill:** rounded `100px` radius, `#00c483` background.

### 1.4 The render pipeline (identical everywhere)

```
build.py  ──writes──▶  _html/<slug>.html  ──headless Chrome──▶  <slug>.png
```

Standard Chrome invocation used by all builders:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=<W>,<H> --virtual-time-budget=9000 \
  --run-all-compositor-stages-before-draw \
  --screenshot=<out.png> file://<in.html>
```

- The `--window-size` **must equal the canvas pixel size** in the HTML (`html,body{width/height}`).
- `--virtual-time-budget` gives webfonts + images time to load before the snapshot.
- **macOS-specific:** the hardcoded Chrome path must be changed on Linux/Windows.

### 1.5 Brand voice (one line)

> **"Calm-authoritative documentary observer."** Plain, confident, a little
> literary. Names a real company or person. States the idea, then lands a single
> sharp bottom line. Never hype, never emoji-spam, never exclamation marks.
> (Canonical reference: `final_video/social-media-pillars-2026-05`.)

---

## 2. Folder map

```
postizz/
├── README.md                  ← THIS FILE (master design + copy spec)
├── _gen_v2.py                 ← industry logo-tile generator (fal.ai Gemini 3 Pro)
├── _gen_two.py                ← earlier 2-tile generator (superseded by _gen_v2)
├── _regen_node.py             ← one-off: regenerate the IT/SaaS node tile, sparser icon
├── 01..14-*.png               ← loose first-pass tiles (the canonical set lives in v2/)
│
├── v2/                        ← ✅ CANONICAL industry logo tiles for the app (13 tiles)
│   ├── 01..13-*.png           ← 4:3 rainbow-border icon tiles
│   ├── _orig_backup/          ← pre-edit originals (kept after the Jun-17 reframe fix)
│   └── postizz-v2-images.zip  ← zipped deliverable of the 13 tiles
│
├── glossary/                  ← "The Business Glossary" term cards, 3 platforms
│   ├── _cards_v6.py           ← canonical card DATA (term, course, image, body, hashtags)
│   ├── _cards_ext.py          ← Jun14–Jul2 extension terms (auto-merged)
│   ├── _social_meta.py        ← BRAND/HOOK/ATTR/BOLD maps + bolden() helper
│   ├── lib/postiz.py          ← Postiz API client (upload + schedule)
│   ├── linkdn/                ← LinkedIn 1080×1350 (4:5) cards + captions
│   ├── insta/                 ← Instagram 1080×1080 (1:1) cards + captions
│   └── whatsapp/              ← WhatsApp 1080×1350 cards + *bold* captions (manual post)
│
├── jargons/                   ← "MBA Jargon" framework cards
│   ├── _build.py              ← card + diagram renderer (grid/steps/funnel/pyramid/curve/versus/focus)
│   ├── marketing-sem1/        ← rendered set for the Marketing Term-1 course
│   └── _samples/
│
├── email/                     ← email header banners + ready-to-send mailers
│   ├── _build.py              ← banner generator (1200×400 @2x → displays 600×200)
│   ├── banner-*.png           ← rendered banners (edge/hireable/think/notes/light…)
│   ├── mailer/                ← full HTML email templates + previews
│   ├── NOTES_FEATURE.md       ← Voice Notes product/engineering reference (context, not creative)
│   └── *.jpeg                 ← real app screenshots used inside the Voice Notes mailer
│
└── hoardings/                 ← large-format posters / standees / billboards
    ├── posters/v1/_build.py   ← 1080×1920 (9:16) vertical poster/standee, 10 headlines + QR
    ├── posters/v1/_export_print.py ← print-resolution export
    ├── campaign/              ← 1080×1920 Voice-Notes campaign posters
    └── _samples/              ← 1920×1080 (16:9) landscape hoardings, incl. Hinglish concepts
```

---

## 3. `v2/` — Industry logo tiles (APP)

**Purpose.** The 13 fallback **company/industry logos** shown in the Rehearsal app's
"Companies" grid. When a real company has no logo, the app shows the tile for its
industry (e.g. "360 Degree Cloud" → IT/SaaS node tile; "Custom Upload" → upload tile).

**The set (filename → icon concept):**

| File | Industry | White icon |
|---|---|---|
| `01-it-services-saas.png` | IT services / SaaS | sparse 7-node network graph (6-node ring + central hub) |
| `02-financial-services-banking.png` | Banking | Greek-temple bank facade (pediment + columns) |
| `03-insurance.png` | Insurance | heraldic protection shield |
| `04-fmcg-consumer-durables.png` | FMCG | two cresting ocean waves |
| `05-retail-fashion.png` | Retail / fashion | safety-pin / clothing-tag loop |
| `06-consulting-advisory.png` | Consulting | inverted triangle balancing on a bar (fulcrum) |
| `07-manufacturing-industrial.png` | Manufacturing | sawtooth factory roofline |
| `08-automotive.png` | Automotive | three right-pointing chevrons (speed) |
| `09-logistics-supply-chain.png` | Logistics | S-curve route with 3 map pins |
| `10-energy-utilities.png` | Energy | radiant sun with rays |
| `11-hospitality.png` | Hospitality | colonnade of 3 rounded arches |
| `12-miscellaneous-others.png` | Misc | circle + triangle + square cluster |
| `13-custom-upload.png` | Custom upload (user CTA) | upload/share arrow over a tray |

### 3.1 Visual spec

- **Canvas:** 2400 × 1792 px (**4:3 landscape**), pure matte-black `#0a0a0a`, edge-to-edge.
- **The card:** a centered vertical rounded-rectangle, **outlined by a single continuous
  rainbow-gradient stroke** sweeping `#9677f8 → #4e44fd → #ff4859 → #ff5e00 → #00c483`
  (note: tiles use orange `#ff5e00` as an extra stop). The stroke **glows softly**; the
  card interior is the same black as the background, so it reads as a luminous outline only.
- **The icon:** one bold, flat, pure-white geometric glyph, perfectly centered. No 3D, no
  bevel, no gradient on the icon, no text/letters/numbers anywhere.

### 3.2 How they're generated

These are **AI-generated** (not HTML/Chrome), via **fal.ai Gemini 3 Pro Image**:

```bash
# needs FAL_KEY in repo-root .env
python3 _gen_v2.py                 # regenerate all 12 base tiles
python3 _gen_v2.py 03-insurance    # regenerate one (substring match on filename)
```

- Model: `fal-ai/gemini-3-pro-image-preview`, `aspect_ratio:"4:3"`, `resolution:"2K"`, PNG.
- The full prompt template (`FRAME`) lives in `_gen_v2.py`. **Critical prompt rules baked
  in:** "EXACTLY ONE single continuous border stroke … do NOT draw a double border / no
  concentric outline"; "flat geometric edges, no 3D bevel, no gradient on the icon";
  "Absolutely NO text/letters/numbers/watermarks". Generation is non-deterministic — always
  eyeball the output for a double border or a drifted icon.
- `_regen_node.py` is a one-off that regenerates **only** tile 01 with a *sparser* node icon
  (writes candidates to `v2/_cand/` so you can pick before overwriting).

### 3.3 ⚠️ The app-crop gotcha (READ THIS before editing tiles)

The source tiles are **4:3 landscape**, but the app renders each logo in a **portrait/square
card** using object-fit-cover. The app keeps the full image height and **crops the center
~1344px of width**, discarding the left/right black margins.

**Consequence:** if the glowing card is wider than ~1344px, the app crops the rainbow border
right up against the tile edge — it looks cramped. (This is exactly the bug fixed on 2026-06-17
for tiles 02, 03, 07, 13.)

**Target spec to stay safe:** the card (including its glow) should be **≤ ~1100px wide**, leaving
~120px of black margin on each side inside the crop window.

**The deterministic fix (no AI regen needed)** — shrink-and-recenter the card on a fresh black
canvas, keeping 4:3:

```python
# pseudo: detect content bbox by luminance threshold (~45), if card width > ~1130,
# scale the whole image so card width == 1100, paste centered on a 2400x1792 canvas
# filled with the image's own corner color (#0a0a0a-ish). Originals → v2/_orig_backup/.
```

If you ever want to retire this gotcha permanently, **regenerate the tiles at the app's actual
display ratio (square 1:1 or 3:4)** so nothing gets cropped — that's a regenerate-all job.

### 3.4 `v2/` vs `v3/` (which tile set is canonical?)

There are two generations of the industry tiles. **Pick one set when wiring the app — don't mix.**

| | `v2/` | `v3/` |
|---|---|---|
| Generator | `_gen_v2.py` | `_gen_v3.py` |
| Inner card shape | varies per tile (some wide/square → caused the crop bug) | **forced strict portrait ~3:4** on every tile |
| Crop-safety | needs the §3.3 shrink-and-recenter fix (already applied to 02/03/07/13) | designed so the tall card survives the app's portrait crop natively |
| Status | the set most recently hand-fixed (Jun 17) | the cleaner regenerate-all approach to the same crop problem |

`v3/` is the **forward direction** (it bakes the §3.3 lesson into generation). Same prompt
system, same 4:3 black canvas, same rainbow border, same 13 industries — only the inner-card
proportion is constrained. The loose top-level `01..14-*.png` are the original first pass and
are **superseded** by both.

> The loose top-level zips (`v3/postizz-v3-images.zip`, `glossary/whatsapp/whatsapp-cards.zip`)
> are >50 MB delivery bundles — GitHub warns but accepts them (<100 MB hard limit). They are
> derived artifacts; regenerate from the builders rather than relying on the zips.

---

## 4. `glossary/` — "The Business Glossary" cards

**Purpose.** A daily-ish social series that teaches **one business concept per card**
(e.g. *Goodhart's Law*, *Anchoring*, *Network Effect*), each grounded in a real company or
named thinker and **pulled from an active Rehearsal course**. ~60 terms built, scheduled on
Postiz (LinkedIn `GradelessAI` + Instagram `tryrehearsal.ai`), running Jun 4 – Jul 2; WhatsApp
posted manually.

### 4.1 The canonical data (single source — never duplicate)

All three platforms read the **same** card data from `_cards_v6.py` (which auto-merges
`_cards_ext.py`). This guarantees the definition, course, image, and verified facts never drift
between platforms. Each card is a dict:

```python
{
  "slug": "goodharts-law",
  "course": "young-professional-second-order-thinking",  # local visuals folder
  "image": "visual-0-cover.png",                          # from repo visuals/<course>/
  "headline": "Goodhart's Law",
  "explanation": "para 1\n\npara 2\n\npunchy bottom line",  # \n\n-separated paragraphs
  "close": "Find more like this on Rehearsal.",            # rotating CTA
  "hashtags": "#SystemsThinking #Incentives #BusinessStrategy",
}
```

- **`BOLD_V6` / `BOLD`** (in `_cards_v6.py` and `_social_meta.py`) maps slug → the
  person/company names to **bold white** in the body (must appear in the first two
  paragraphs, since that's what the IG square shows). `bolden()` wraps longest-match-first.
- **`BRAND` / `HOOK` / `ATTR`** (in `_social_meta.py`) hold the company/personality badge,
  the vivid on-image "catching point" line, and web-verified attribution sentences.

> **Brand rule (user directive):** every glossary term must name the **company or personality**
> related to its source course — on the image and in the caption. Facts must be **web-verifiable**
> (no ghost citations). See repo-root `CLAUDE.md` factual-verification rules.

### 4.2 Visual spec — the v6 "green knowledge card"

Shared layout across all three platforms (only the canvas size changes):

- Canvas bg `#0a0a0c`, Raleway, with a soft **green** radial glow at the top
  (`rgba(0,196,131,0.18)`).
- **Masthead** (eyebrow): `THE BUSINESS GLOSSARY`, weight 800, 27px, letter-spacing 6px,
  flanked by two short rainbow rules.
- **Card** (`#141418`, radius 40px, 1px green-tinted border `rgba(0,196,131,0.28)`):
  - top = **full-width course image** banner (`object-fit:cover`, ~620px tall on 4:5).
  - **Headline** = the term, weight 900, **rainbow-gradient text fill**, size auto-scaled by
    length (`hsize()`: 70px ≤10 chars → 40px >26 chars).
  - **Body** = up to 3 paragraphs, weight 300, 26px, `#d6dae1`, with names bolded white.
- **Footer (below the card):** centered Rehearsal wordmark + rainbow underline, then the green
  **"Download the Rehearsal app"** pill, on the green glow.
- Grain overlay + bottom rainbow stripe.

| Platform | Folder | Canvas | Notes |
|---|---|---|---|
| LinkedIn | `linkdn/` | **1080 × 1350 (4:5)** | `<slug>.png` + `<slug>.md` caption |
| Instagram | `insta/` | **1080 × 1080 (1:1)** | `<slug>-sq.png`; first 2 paragraphs visible |
| WhatsApp | `whatsapp/` | **1080 × 1350 (4:5)** | `<slug>.png` + copy-paste `*bold*` caption |

### 4.3 Caption styles (differ per platform — this is the important part)

The **on-card body** is the same brand-voice copy everywhere. The **caption** changes:

**LinkedIn** (`linkdn/<slug>.md`) — full explanation, a rotating close line, then plain
download links, then 3 topical hashtags. No emoji, no "link in bio". Example tail:

```
…The skill isn't talking the anchor down once it lands. It's setting the frame before a number is ever spoken.

Find more like this on Rehearsal.

iOS: https://apps.apple.com/in/app/try-rehearsal-ai/id6762619041
Android: https://play.google.com/store/apps/details?id=ai.rehearsal.app
Web: https://rehearsal.gradeless.ai/

#Negotiation #BehavioralEconomics #BusinessStrategy
```

**Instagram** (`insta/<slug>.md`, written by `_captions_ext.py`) — hook = the card's first
paragraph; body = the rest; the rotating close; then **`Link in bio.`**; then a deduped
**5–7 hashtag** set built as `#Rehearsal #ConceptBriefs <card tags> #MBA`.

**WhatsApp** (`whatsapp/<slug>.md`) — uses WhatsApp markdown: **`*bold*`** term + names,
`_italic_` for the virality line **`_Forward this to someone prepping for placements._`**,
a 📲 emoji + plain auto-linking iOS/Android/Web URLs. **No hashtags.** Manual posting (Postiz
has no WhatsApp channel).

### 4.4 Regenerate & publish

```bash
# from postizz/glossary/
python3 linkdn/_build.py <slug> [<slug>…]        # LinkedIn card(s) + caption(s); no args = all
python3 insta/_build.py square <slug> [<slug>…]  # Instagram square card(s)
python3 insta/_captions_ext.py                   # (re)write IG captions from card data
python3 whatsapp/_build.py <slug> [<slug>…]      # WhatsApp card(s) + caption(s)

# publish (LinkedIn + IG) — needs POSTIZ_API_KEY / POSTIZ_API_URL in repo-root .env
set -a; source ../../.env; set +a
python3 linkdn/_upload_postiz.py <slug>…         # upload PNGs → Postiz, schedule via MCP
```

Per-post ledgers: `linkdn/log.md`, `insta/log.md`. Schedule plans: `_schedule_plan.json`.

---

## 5. `jargons/` — "MBA Jargon" cards

**Purpose.** Teach a **named MBA framework** (4 Ps, STP, AIDA, Product Life Cycle, Brand
Equity, USP…) as a clean diagrammatic card. Built for the **Marketing Term-1** course
(`marketing-sem1/`). LinkedIn portrait 1080 × 1350.

### 5.1 Card anatomy (`_build.py`)

`MBA JARGON` masthead → subject **pill** ("Marketing", coral `#ff4859`) → a marketing-course
**image banner** (392px) → **rainbow/coral headline** term → one-line plain-English **definition**
(weight 600, 29px) → a **framework diagram** → a web-verified **origin note** (who coined it, what
year, one insight; names bolded white).

- Card bg `#131318`, radius 44px; canvas `#0a0a0c`; coral glow; wordmark + green CTA footer;
  grain + bottom rainbow stripe. Headline size auto-scales (`hs()`: 78/64/52px).

### 5.2 The 7 diagram renderers (the distinctive part)

Each card declares `"diag": (type, data)`; `_build.py` renders pure-CSS/SVG diagrams using the
4-color palette `["#9677f8","#4e44fd","#ff4859","#00c483"]`:

| `type` | Renders | Used by e.g. |
|---|---|---|
| `grid` | 2×2 labelled cells with colored bullets | 4 Ps, 4 Cs, Segmentation |
| `steps` | horizontal numbered circles + arrows | STP |
| `funnel` | narrowing colored tiers | AIDA, Marketing Funnel |
| `pyramid` | widening tiers bottom-up | Brand Equity (CBBE) |
| `curve` | SVG S-curve + phase labels | Product Life Cycle |
| `versus` | two columns + "vs" | Penetration vs Skimming |
| `focus` | bars with one highlighted (the USP) | USP |

### 5.3 Copy style + run

Definition = one plain sentence ("The four levers every marketer controls: …"). Note = origin
+ a sharp takeaway ("Change one P and the other three have to answer for it."). Data + copy are
inline in the `CARDS` list in `_build.py`.

```bash
# from postizz/jargons/
python3 _build.py            # all cards → marketing-sem1/<slug>.png
python3 _build.py 4ps stp    # specific slug(s)
```

---

## 6. `email/` — header banners + mailers

**Purpose.** Branded **email header banners** and two **ready-to-send HTML mailers**.

### 6.1 Banners (`_build.py`)

- Canvas **1200 × 400 @2x → displays at 600 × 200** (standard email header width).
- Horizontal split: left = eyebrow + 900-weight headline (one line rainbow-filled) + sub +
  optional partner line; right = wordmark + status **chip** ("Batch starts 29 June") + green CTA.
- **DARK** theme is default; **LIGHT** theme (`#fff` bg) for light email templates.
- Concept keys (each a headline/sub/CTA combo): `notes`, `notes-saidit`, `edge`, `hireable`,
  `think`, `light`. Voice example: *"Rehearse for **months.** Not the night before."*
- Partner rule: Rehearsal-branded; **only a small "In partnership with Jaipuria Institute of
  Management" line**, never a co-branded lockup.

```bash
# from postizz/email/
python3 _build.py            # all banners
python3 _build.py edge       # one concept
```

### 6.2 Mailers (`mailer/`)

Full HTML emails to paste into an ESP (Mailchimp/Brevo/Zoho). Before sending, replace tokens:
`{{BANNER_URL}}` (upload the PNG to a CDN — email can't read `file://`), `{{IMG_*}}`,
`{{FirstName}}`, `{{UnsubscribeURL}}`. Two templates: the **Rehearsal × Jaipuria admissions**
mailer and the **Voice Notes** consumer mailer. See `mailer/README.md` for exact steps and
subject-line options. `NOTES_FEATURE.md` is the **product/engineering** reference for the Voice
Notes feature (background context for the copy, not a creative asset).

---

## 7. `hoardings/` — posters, standees & billboards

**Purpose.** Large-format print/display creative for campus campaigns.

### 7.1 `posters/v1/` — vertical posters / standees (1080 × 1920, 9:16)

One shared template, **10 headlines** (white line + rainbow line), e.g. *"Save it. / Sound like
you said it."*, *"Notes that / talk back."*. Layout: big Rehearsal wordmark + rainbow underline →
green **"Free Pro Tier for all Jaipuria students & staff"** kicker → headline → a course image
crop → sub-copy → **two QR tiles** (Apple + Google Play, white tiles with inline white store
logos) → green CTA → bottom rainbow stripe. Each headline maps to a specific course visual
(`POSTER_VISUALS`) with a deliberate palette rotation across the set.

```bash
# from postizz/hoardings/posters/v1/
python3 _build.py                 # all 10 posters
python3 _build.py said-it counts  # specific slug(s)
python3 _export_print.py          # print-resolution export
```

QR sources: `hoardings/_samples/qr-ios.png`, `qr-android.png` (black-on-white).

### 7.2 `campaign/` — Voice Notes campaign posters (1080 × 1920)

Centered hero variant: big wordmark → green "free" pill → giant 124px headline (rainbow on the
key phrase) → sub → green CTA → QR pair → stripe. Concepts: `talk-back`, `said-it`, `working`,
`sharper`, `smarter`, `counts`, `second-brain`, `scribbles`, `you-know`.

### 7.3 `_samples/` — landscape hoardings (1920 × 1080, 16:9)

Concept billboards including **Hinglish** lines (`mock-ek-baar`, `padh-liya`,
`rehearsal-kiya-kya`) — left-aligned 150px headline with a rainbow accent, kicker in coral,
sub, green CTA pill + URL, and a visual motif on the right. Use these as the tone reference for
campus-facing, code-switching copy.

---

## 8. Copywriting voice — the full guide

**Voice = calm-authoritative documentary observer.** Every line should sound like a confident
narrator stating something true, not a brand shouting.

**Do**
- Open with a concrete scene or a counter-intuitive claim ("A daycare fined parents for picking
  their kids up late. Late pickups went up.").
- Name a **real** company or person, and **bold it white** on the card.
- Keep paragraphs to 2–3 sentences. End on a single **sharp bottom line** that reframes
  ("Every metric you incentivise is a metric you can no longer fully trust.").
- Use web-verifiable facts (years, names, figures). Hedge private-company revenue claims.
- Rotate the close line ("Find more like this on Rehearsal." / "Read more on Rehearsal.").

**Don't**
- No exclamation marks, no hype adjectives, no emoji on LinkedIn/IG card bodies.
- No fabricated quotes, no ghost citations, no "Study by X (Year)" that can't be web-found.
- No co-branded Jaipuria lockups — partner line only.
- Don't drift facts between platforms — edit the **canonical data file**, then re-render all.

**Hashtags / CTAs per channel**

| Channel | Hashtags | CTA / links |
|---|---|---|
| LinkedIn | 3 topical, end of caption | "Find more like this on Rehearsal." + plain iOS/Android/Web links |
| Instagram | 5–7 (`#Rehearsal #ConceptBriefs … #MBA`) | rotating close + **"Link in bio."** |
| WhatsApp | none | `_Forward this to someone prepping for placements._` + 📲 links |
| Email | none | green pill ("Try free → tryrehearsal.ai" / "Record your first note") |
| Poster | none | green pill + QR codes |

**Canonical product links**
- iOS: `https://apps.apple.com/in/app/try-rehearsal-ai/id6762619041`
- Android: `https://play.google.com/store/apps/details?id=ai.rehearsal.app`
- Web: `https://rehearsal.gradeless.ai/`

---

## 9. Environment & dependencies

| Need | For | Where |
|---|---|---|
| **Google Chrome** (hardcoded macOS path) | all HTML→PNG renders | edit `CHROME=` for other OSes |
| **Internet** | webfonts (Raleway) + some assets at render | required during render |
| **Python 3** | every build script | — |
| **Pillow** (`pip install Pillow`) | `v2/` tile bbox/reframe post-processing | — |
| **`FAL_KEY`** | `v2/` tile AI generation (fal.ai) | repo-root `.env` |
| **`POSTIZ_API_KEY` / `POSTIZ_API_URL`** | publishing via Postiz | repo-root `.env` |
| `sips` (macOS) | PNG format normalize in `_gen_v2.py` | built-in on macOS |

Card **images** for glossary/jargon/poster come from the repo's `visuals/<course>/` folders —
those courses must exist locally or the builder logs `! MISSING image` and skips.

---

## 10. Conventions & gotchas (don't repeat past mistakes)

- **Edit data, not renders.** Glossary copy lives in `_cards_v6.py`/`_cards_ext.py`; jargon copy
  in `jargons/_build.py CARDS`; poster/email copy in their `_build.py`. Re-render after editing.
- **Canvas size must match `--window-size`.** A mismatch crops or letterboxes the screenshot.
- **`v2/` tiles: respect the ≤1100px card-width rule** (see §3.3) or the app crops the border.
  Originals are in `v2/_orig_backup/`.
- **fal.ai is non-deterministic.** Always check regenerated tiles for double borders / drifted
  icons / accidental text.
- **Facts are web-verified, not plausible-sounding.** Repo-root `CLAUDE.md` makes this a hard rule.
- **WhatsApp is manual** — there's no Postiz channel; ship PNG + `.md` only.
- **Files prefixed `_`** are scripts/intermediates (`_build.py`, `_html/`, `_postiz_media.json`,
  `_schedule_plan.*`); un-prefixed `<slug>.png` / `<slug>.md` are the deliverables.
