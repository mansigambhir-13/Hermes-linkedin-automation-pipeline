"""Build the Postiz MCP schedule payload for the v6 cards + a log.md dedup record.

2 posts/day for 10 days, 11:30 IST (06:00 UTC) and 16:30 IST (11:00 UTC),
GradelessAI LinkedIn page. Emits _schedule_plan.json (socialPost array ready for
the Postiz MCP integrationSchedulePostTool) and writes log.md.
"""
import html
import importlib.util
import json
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).parent

# card data + links
_c = importlib.util.spec_from_file_location("cards_v6", HERE / "_cards_v6.py")
cards_v6 = importlib.util.module_from_spec(_c); _c.loader.exec_module(cards_v6)
_l = importlib.util.spec_from_file_location("v5linkdn", HERE.parent / "_build.py")
v5 = importlib.util.module_from_spec(_l); _l.loader.exec_module(v5)

CARD = {c["slug"]: c for c in cards_v6.NEW_CARDS}
LINKS = v5.LINKS
MEDIA = json.loads((HERE / "_postiz_media.json").read_text())

INTEGRATION_ID = "cmj85z26h07nxnn0ynjm91da2"   # GradelessAI (linkedin-page)
BASE = date(2026, 6, 4)                          # today
AM_UTC, PM_UTC = "06:00:00.000Z", "11:00:00.000Z"  # 11:30 / 16:30 IST

# (day offset, slot, slug) — curated for domain variety across each day
PLAN = [
    (0, "AM", "keeper-test"),        (0, "PM", "first-principles"),
    (1, "AM", "dark-store"),         (1, "PM", "inversion"),
    (2, "AM", "kasparovs-law"),      (2, "PM", "vitality-curve"),
    (3, "AM", "flight-to-quality"),  (3, "PM", "goodharts-law"),
    (4, "AM", "retrospective-taxation"), (4, "PM", "career-capital"),
    (5, "AM", "jagged-frontier"),    (5, "PM", "surrogation"),
    (6, "AM", "weighted-distribution"), (6, "PM", "pre-mortem"),
    (7, "AM", "automation-paradox"), (7, "PM", "sharpe-ratio"),
    (8, "AM", "idiot-index"),        (8, "PM", "scope-creep"),
    (9, "AM", "tragedy-of-the-commons"), (9, "PM", "crowding-out-effect"),
]


def content_html(slug: str) -> str:
    c = CARD[slug]
    lines = [p.strip() for p in c["explanation"].split("\n\n") if p.strip()]
    lines.append(c["close"])
    lines += [ln for ln in LINKS.split("\n") if ln.strip()]
    lines.append(c["hashtags"])
    return "".join(f"<p>{html.escape(ln)}</p>" for ln in lines)


def iso(day_off: int, slot: str) -> str:
    d = BASE + timedelta(days=day_off)
    return f"{d.isoformat()}T{AM_UTC if slot == 'AM' else PM_UTC}"


social_post = []
log_rows = []
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
        "settings": [],
    })
    d = BASE + timedelta(days=day_off)
    ist = "11:30" if slot == "AM" else "16:30"
    log_rows.append((d.isoformat(), ist, slug, CARD[slug]["headline"], m["path"]))

(HERE / "_schedule_plan.json").write_text(json.dumps(social_post, indent=2))

# log.md — dedup ledger so nothing is re-posted
lines = [
    "# v6 LinkedIn glossary — posting log",
    "",
    "Platform: **GradelessAI** LinkedIn page (`cmj85z26h07nxnn0ynjm91da2`) · via Postiz MCP",
    "Schedule: 2/day, 11:30 & 16:30 IST. Do NOT re-schedule any slug listed below.",
    "",
    "| Date | IST | Slug | Term | Image |",
    "|------|-----|------|------|-------|",
]
for d, ist, slug, head, path in log_rows:
    lines.append(f"| {d} | {ist} | `{slug}` | {head} | {path} |")
held = ["center-of-gravity", "shifting-the-burden"]
lines += ["", f"**Held back (not scheduled):** {', '.join(held)} — available for a future drop."]
(HERE / "log.md").write_text("\n".join(lines) + "\n")

print(f"wrote _schedule_plan.json ({len(social_post)} posts) and log.md")
print(f"first slot: {social_post[0]['date']}  last slot: {social_post[-1]['date']}")
