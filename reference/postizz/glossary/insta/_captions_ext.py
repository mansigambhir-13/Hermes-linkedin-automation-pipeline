"""Generate Instagram captions for the extension cards (Jun 14 – Jul 2).

Derives each caption from the merged card data (_cards_v6 + _cards_ext): the IG
caption hook is the card's first paragraph, the body is the remaining paragraphs,
the CTA is the card's rotating close, then 'Link in bio.' and an IG hashtag set.
Voice already matches the brand brief (the card copy is written in it). Writes
{slug}.md into this folder for the 38 extension slugs only.
"""
import importlib.util
from pathlib import Path

HERE = Path(__file__).parent
_v = importlib.util.spec_from_file_location("v6cards", HERE.parent / "_cards_v6.py")
v6 = importlib.util.module_from_spec(_v); _v.loader.exec_module(v6)
_e = importlib.util.spec_from_file_location("cardsext", HERE.parent / "_cards_ext.py")
ext = importlib.util.module_from_spec(_e); _e.loader.exec_module(ext)

EXT_SLUGS = [c["slug"] for c in ext.CARDS_EXT]
CARD = {c["slug"]: c for c in v6.NEW_CARDS}

MD = """# {headline} — Instagram caption

**Platform:** Instagram feed, square 1080x1080 (`{slug}-sq.png`)
**Series:** The Business Glossary (v6 · Jun 14 – Jul 2 extension)
**Voice:** Rehearsal calm-authoritative documentary observer (social-media-pillars-2026-05)
**Source course:** `{course}`

## Caption

{hook}

{body}

{cta}

Link in bio.

{tags}
"""


def ig_tags(card):
    # branded + the card's LinkedIn topical tags + MBA; dedupe, keep 5-7
    base = ["#Rehearsal", "#ConceptBriefs"] + card["hashtags"].split() + ["#MBA"]
    seen, out = set(), []
    for t in base:
        if t.lower() not in seen:
            seen.add(t.lower()); out.append(t)
    return " ".join(out)


def main():
    for slug in EXT_SLUGS:
        c = CARD[slug]
        paras = [p.strip() for p in c["explanation"].split("\n\n") if p.strip()]
        hook, body = paras[0], "\n\n".join(paras[1:])
        (HERE / f"{slug}.md").write_text(MD.format(
            headline=c["headline"], slug=slug, course=c["course"],
            hook=hook, body=body, cta=c["close"], tags=ig_tags(c),
        ))
    print(f"wrote {len(EXT_SLUGS)} IG caption .md files")


if __name__ == "__main__":
    main()
