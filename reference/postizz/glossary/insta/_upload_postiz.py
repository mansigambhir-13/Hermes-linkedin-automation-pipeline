"""Upload v6 square IG card PNGs ({slug}-sq.png) to Postiz; emit slug -> {id,path}.
Usage:  set -a; source <repo>/.env; set +a
        python3 _upload_postiz.py slug1 slug2 ...
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))  # glossary/ holds lib
from lib import postiz                              # noqa: E402

OUT = HERE / "_postiz_media.json"


def main(slugs):
    media = json.loads(OUT.read_text()) if OUT.exists() else {}
    for slug in slugs:
        png = HERE / f"{slug}-sq.png"
        if not png.exists():
            print(f"  ! missing {png}", file=sys.stderr); continue
        if slug in media:
            print(f"  = already {slug} -> {media[slug]['id']}"); continue
        m = postiz.upload_media(png)
        media[slug] = {"id": m.id, "path": m.path}
        print(f"  + {slug:24s} -> {m.path}")
        OUT.write_text(json.dumps(media, indent=2))
    OUT.write_text(json.dumps(media, indent=2))
    print(f"\n  wrote {OUT.name} ({len(media)} entries)")


if __name__ == "__main__":
    main(sys.argv[1:])
