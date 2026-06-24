"""Bundle the WhatsApp glossary cards for phone-side scheduling (SKEDit / Do It Later).

Produces, in CARDS order:
  _all-captions.txt    one block per card: the PNG filename + full WhatsApp caption,
                       so you can copy-paste captions on the phone in posting order.
  _all-captions-short.txt   1-line hook + link version (better when sending image+text
                       to a group, since the card image already carries the content).
  whatsapp-cards.zip   all 60 <slug>.png in one archive for Drive/transfer.

Usage:  python3 _export_for_phone.py
"""
import importlib.util
import re
import zipfile
from pathlib import Path

HERE = Path(__file__).parent
GLOSSARY = HERE.parent

_c = importlib.util.spec_from_file_location("cards_v6", GLOSSARY / "_cards_v6.py")
_cv = importlib.util.module_from_spec(_c); _c.loader.exec_module(_cv)
CARDS = {c["slug"]: c for c in _cv.NEW_CARDS}
ORDER = list(CARDS.keys())

LINKS = "📲 tryrehearsal.ai  ·  App Store / Google Play: search \"Rehearsal AI\""


def caption_from_md(slug):
    md = (HERE / f"{slug}.md").read_text()
    return md.split("## Caption (copy-paste)\n\n", 1)[1].strip()


def short_caption(slug):
    c = CARDS[slug]
    hook = [p.strip() for p in c["explanation"].split("\n\n") if p.strip()][0]
    return (f"*{c['headline']}* — {hook}\n\n"
            f"_Forward this to someone prepping for placements._\n\n{LINKS}")


def main():
    full, short = [], []
    for i, slug in enumerate(ORDER, 1):
        sep = f"\n\n{'='*60}\n#{i:02d}  IMAGE: {slug}.png\n{'='*60}\n\n"
        full.append(sep + caption_from_md(slug))
        short.append(sep + short_caption(slug))
    (HERE / "_all-captions.txt").write_text("".join(full).lstrip())
    (HERE / "_all-captions-short.txt").write_text("".join(short).lstrip())

    zpath = HERE / "whatsapp-cards.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for i, slug in enumerate(ORDER, 1):
            png = HERE / f"{slug}.png"
            if png.exists():
                z.write(png, f"{i:02d}-{slug}.png")   # numbered = posting order on phone

    print(f"  _all-captions.txt        ({len(ORDER)} captions, full)")
    print(f"  _all-captions-short.txt  ({len(ORDER)} captions, 1-line + link)")
    print(f"  whatsapp-cards.zip       ({len(ORDER)} PNGs, numbered in posting order)")


if __name__ == "__main__":
    main()
