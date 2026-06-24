# postizz / glossary

The Rehearsal "Business Glossary" social-card pipeline, moved out of the old
deeply-nested path (`automation/linkdn/glossary/v5/linkdn/v6/`) into one clean
place. Split by platform.

```
postizz/glossary/
├── _cards_v6.py      ← canonical card data (term, course, image, body, bold, hashtags)
├── _cards_ext.py     ← Jun 14–Jul 2 extension terms (auto-merged into _cards_v6)
├── _social_meta.py   ← bolden() helper (white-bolds names in the body)
├── lib/postiz.py     ← Postiz API client (upload + schedule); reads POSTIZ_API_KEY from env
├── linkdn/           ← LinkedIn 4:5 portrait cards
│   ├── <slug>.png    ← rendered card        <slug>.md ← LinkedIn caption
│   ├── _build.py     ← render LinkedIn cards
│   ├── _upload_postiz.py · _schedule_plan.py · _postiz_media.json · log.md · _html/
├── insta/            ← Instagram 1:1 square cards
│   ├── <slug>-sq.png ← rendered card        <slug>.md ← Instagram caption
│   ├── _build.py     ← render IG squares    _captions.py · _captions_ext.py ← write IG captions
│   ├── _upload_postiz.py · _schedule_plan.py · _postiz_media.json · log.md · _html/
└── whatsapp/         ← WhatsApp 4:5 portrait cards (MANUAL posting — no Postiz channel)
    ├── <slug>.png    ← rendered card        <slug>.md ← WhatsApp caption (*bold* + links)
    ├── _build.py     ← render cards + write captions    _html/
```

## Regenerate

```bash
# from postizz/glossary/
python3 linkdn/_build.py <slug> [<slug> ...]      # LinkedIn card(s) + caption(s)
python3 insta/_build.py square <slug> [<slug>]    # Instagram square card(s)
python3 insta/_captions_ext.py                    # (re)write IG captions from card data
python3 whatsapp/_build.py <slug> [<slug> ...]    # WhatsApp card(s) + caption(s) — manual post

# publish (needs POSTIZ_API_KEY / POSTIZ_API_URL in the repo .env)
set -a; source ../../.env; set +a
python3 linkdn/_upload_postiz.py <slug> ...        # upload PNGs → Postiz, then schedule via the MCP
```

Card images are pulled from the repo's `visuals/<course>/` folders. Voice + layout
spec and the full caption style guide live in `social_training/HANDOFF.md`.

**Status:** 60 glossary terms built and scheduled on Postiz (LinkedIn GradelessAI +
Instagram tryrehearsal.ai), running Jun 4 – Jul 2. See `linkdn/log.md` and
`insta/log.md` for the per-post ledgers.
```
