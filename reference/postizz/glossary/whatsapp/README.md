# postizz / glossary / whatsapp

WhatsApp variant of the v6 green "knowledge card" — the same Business Glossary
cards as `linkdn/` and `insta/`, rendered for WhatsApp with WhatsApp-native
captions. **Manual posting** (Postiz has no WhatsApp channel), so this line
ships PNG cards + copy-paste `.md` captions only — no `_upload_postiz.py` /
`_postiz_media.json`.

```
whatsapp/
├── _build.py        ← render card(s) + write WhatsApp caption(s)
├── <slug>.png       ← portrait knowledge card (1080×1350, 4:5)
├── <slug>.md        ← copy-paste WhatsApp caption (with *bold* + links)
└── _html/           ← intermediate render HTML
```

Shares the canonical card data at `../_cards_v6.py` (+ `../_cards_ext.py`), so
definitions, courses, images and verified facts never drift from LinkedIn /
Instagram. Card images come from the repo's `visuals/<course>/` folders.

## What's WhatsApp-specific

- **Format:** portrait 1080×1350 — large in chat, fits Status / Broadcast / Channel.
- **Caption markdown:** WhatsApp `*bold*` / `_italic_` (single asterisks/underscores),
  not LinkedIn/IG hashtag blocks.
- **Forward line:** `_Forward this to someone prepping for placements._` — WhatsApp's
  native virality mechanic.
- **Links:** plain auto-linking iOS / Android / Web URLs, no hashtag spam.

## Regenerate

```bash
# from postizz/glossary/
python3 whatsapp/_build.py                      # all 60 cards
python3 whatsapp/_build.py first-principles ...  # specific slug(s)
```

## Post (manual)

For each card: attach `<slug>.png`, paste the caption from `<slug>.md`
(WhatsApp preserves the `*bold*` / `_italic_` formatting).

**Status:** 60 glossary cards + captions built for manual WhatsApp posting.
