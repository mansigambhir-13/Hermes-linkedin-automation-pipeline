"""Build the Postiz MCP schedule payload for the v6 square IG cards + log.md.

2 posts/day for 11 days, 16:30 IST (11:00 UTC) and 19:30 IST (14:00 UTC),
tryrehearsal.ai Instagram (instagram-standalone). Emits _schedule_plan.json
(socialPost array for integrationSchedulePostTool) and writes log.md.
"""
import html
import importlib.util
import json
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).parent
_c = importlib.util.spec_from_file_location("captions", HERE / "_captions.py")
cap = importlib.util.module_from_spec(_c); _c.loader.exec_module(cap)
CAPTIONS, HEAD = cap.CAPTIONS, cap.HEAD
MEDIA = json.loads((HERE / "_postiz_media.json").read_text())

INTEGRATION_ID = "cmj873wk707pgnn0ya6de3nf7"     # tryrehearsal.ai (instagram-standalone)
BASE = date(2026, 6, 4)
PM1_UTC, PM2_UTC = "11:00:00.000Z", "14:00:00.000Z"   # 16:30 / 19:30 IST

PLAN = [
    (0, "P1", "keeper-test"),         (0, "P2", "first-principles"),
    (1, "P1", "dark-store"),          (1, "P2", "inversion"),
    (2, "P1", "kasparovs-law"),       (2, "P2", "vitality-curve"),
    (3, "P1", "flight-to-quality"),   (3, "P2", "goodharts-law"),
    (4, "P1", "retrospective-taxation"), (4, "P2", "career-capital"),
    (5, "P1", "jagged-frontier"),     (5, "P2", "surrogation"),
    (6, "P1", "weighted-distribution"), (6, "P2", "pre-mortem"),
    (7, "P1", "automation-paradox"),  (7, "P2", "sharpe-ratio"),
    (8, "P1", "idiot-index"),         (8, "P2", "scope-creep"),
    (9, "P1", "tragedy-of-the-commons"), (9, "P2", "crowding-out-effect"),
    (10, "P1", "center-of-gravity"),  (10, "P2", "shifting-the-burden"),
]


def content_html(slug):
    hook, body, cta, tags = CAPTIONS[slug]
    lines = [hook, body, cta, "Link in bio.", tags]
    return "".join(f"<p>{html.escape(ln)}</p>" for ln in lines)


def iso(day_off, slot):
    d = BASE + timedelta(days=day_off)
    return f"{d.isoformat()}T{PM1_UTC if slot == 'P1' else PM2_UTC}"


social_post, rows = [], []
for day_off, slot, slug in PLAN:
    when = iso(day_off, slot)
    m = MEDIA[slug]
    social_post.append({
        "integrationId": INTEGRATION_ID,
        "isPremium": False,
        "date": when,
        "shortLink": False,
        "type": "schedule",
        "postsAndComments": [{"content": content_html(slug), "attachments": [m["path"]]}],
        "settings": [{"key": "post_type", "value": "post"}],
    })
    ist = "16:30" if slot == "P1" else "19:30"
    rows.append((when, ist, slug, HEAD.get(slug, slug), m["path"]))

(HERE / "_schedule_plan.json").write_text(json.dumps(social_post, indent=2))

L = ["# v6 Instagram (square) glossary — posting log", "",
     "Platform: **tryrehearsal.ai** Instagram (`cmj873wk707pgnn0ya6de3nf7`, instagram-standalone) · via Postiz MCP",
     "Cadence: 2/day at 16:30 & 19:30 IST (11:00 & 14:00 UTC), 2026-06-04 -> 2026-06-14.",
     "**Do NOT re-schedule any slug below.**", "",
     "| # | UTC slot | IST | Slug | Term | Image |",
     "|---|----------|-----|------|------|-------|"]
for i, (utc, ist, slug, head, path) in enumerate(rows, 1):
    L.append(f"| {i} | {utc} | {ist} | `{slug}` | {head} | {path} |")
L += ["", "_Captions: insta/_captions.py · images: insta/{slug}-sq.png · schedule: insta/_schedule_plan.json_"]
(HERE / "log.md").write_text("\n".join(L) + "\n")

print(f"wrote _schedule_plan.json ({len(social_post)} posts) + log.md")
print(f"first: {social_post[0]['date']}  last: {social_post[-1]['date']}")
