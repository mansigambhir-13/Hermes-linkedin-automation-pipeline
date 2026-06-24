"""Instagram variants of the v6 green "knowledge card".

Two layouts, both green-card aesthetic, both Postiz-ready:

  portrait  1080x1350 (4:5) — same card as LinkedIn (image + headline + 3 body
            paras + CTA). Max mobile-feed real estate. Profile-grid thumbnail
            center-crops to square (top/bottom clipped in the grid preview only).

  square    1080x1080 (1:1) — image-forward: big banner + headline + one punch
            line + CTA. Grid-perfect on web and profile; the full DEFINITION
            lives in the Instagram caption (where IG readers expect it).

Usage:  python3 _build.py square keeper-test
        python3 _build.py portrait keeper-test
        python3 _build.py both keeper-test         # render both for compare
        python3 _build.py square                    # all cards, square
"""
import importlib.util
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent              # postizz/glossary/insta
GLOSSARY = HERE.parent                    # postizz/glossary (shared data)
ROOT = HERE.parents[2]                    # repo root
VISUALS = ROOT / "visuals"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GRADIENT = "linear-gradient(90deg,#9677f8 0%,#4e44fd 33%,#ff4859 66%,#00c483 100%)"

_meta_spec = importlib.util.spec_from_file_location("social_meta", GLOSSARY / "_social_meta.py")
_meta = importlib.util.module_from_spec(_meta_spec); _meta_spec.loader.exec_module(_meta)
bolden = _meta.bolden
_c = importlib.util.spec_from_file_location("cards_v6", GLOSSARY / "_cards_v6.py")
_cv = importlib.util.module_from_spec(_c); _c.loader.exec_module(_cv)
CARDS, BOLD = {c["slug"]: c for c in _cv.NEW_CARDS}, _cv.BOLD_V6


def paras(c):
    return [p.strip() for p in c["explanation"].split("\n\n") if p.strip()]


def hsize(headline, big=False):
    n = len(headline)
    base = (78, 70, 60) if big else (70, 62, 54)
    if n <= 10: return base[0]
    if n <= 13: return base[1]
    if n <= 20: return base[2]
    if n <= 26: return base[2] - 10
    return base[2] - 16


# --- shared styling fragments ---------------------------------------------
HEAD = """<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:__W__px;height:__H__px;background:#0a0a0c;overflow:hidden;font-family:'Raleway',sans-serif;color:#fff}
.canvas{position:relative;width:__W__px;height:__H__px;overflow:hidden;background:#0a0a0c;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:__PAD__px 0 30px}
.glow{position:absolute;top:-150px;left:50%;transform:translateX(-50%);width:1240px;height:700px;z-index:0;
  background:radial-gradient(ellipse at center,rgba(0,196,131,0.18) 0%,rgba(0,196,131,0.05) 45%,transparent 72%)}
.mast{position:relative;z-index:3;display:flex;align-items:center;gap:16px;margin-bottom:16px}
.mast .mrule{width:42px;height:4px;border-radius:2px;background:__GRAD__}
.mast .mtitle{font-weight:800;font-size:26px;letter-spacing:6px;text-transform:uppercase;color:#fff}
.card{position:relative;z-index:3;width:1004px;border-radius:40px;background:#141418;
  border:1px solid rgba(0,196,131,0.28);overflow:hidden;box-shadow:0 40px 110px rgba(0,0,0,0.6)}
.banner{display:block;width:100%;height:__BANNER__px;object-fit:cover;background:#0f0f12}
/* square banner: FULL image (no crop), no blur — clean solid backdrop */
.bwrap{position:relative;width:100%;height:__BANNER__px;overflow:hidden;background:#0c0c10}
.bimg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.body{padding:26px 46px 28px}
.headline{font-weight:900;font-size:__HSIZE__px;line-height:0.98;letter-spacing:-2px;
  background:__GRAD__;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent}
.def{margin-top:14px;font-weight:300;font-size:25px;line-height:1.4;color:#d6dae1}
.def b{font-weight:800;color:#fff}
.sqdef{margin-top:13px;font-weight:300;font-size:27px;line-height:1.38;color:#d9dde4}
.sqdef b{font-weight:800;color:#fff}
.punch{margin-top:14px;font-weight:600;font-size:30px;line-height:1.22;color:#fff;letter-spacing:-0.3px}
.footzone{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:15px}
.wm{font-weight:400;font-size:46px;letter-spacing:-1.1px;line-height:0.9;color:#fff}
.wm span{font-weight:200}
.wmline{width:150px;height:5px;border-radius:3px;background:__GRAD__}
.cta{display:inline-flex;align-items:center;gap:12px;background:#00c483;color:#06231a;
  font-weight:800;font-size:24px;letter-spacing:0.3px;padding:16px 38px;border-radius:100px}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.022) 1px,transparent 1px);
  background-size:3px 3px;opacity:0.4;pointer-events:none;z-index:5}
.stripe{position:absolute;left:0;bottom:0;width:100%;height:8px;background:__GRAD__;z-index:6}
</style></head><body>"""

FOOT = """  <div class="grain"></div><div class="stripe"></div>
</div></body></html>"""


def render(html_path, png_path, w, h):
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        f"--window-size={w},{h}", "--virtual-time-budget=9000",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={png_path}", f"file://{html_path}",
    ], check=True, capture_output=True)


def build_portrait(slug, c, img):
    body = "\n".join(
        f'<div class="def">{bolden(p, BOLD.get(slug, []))}</div>' for p in paras(c)[:3]
    )
    html = (HEAD.replace("__W__", "1080").replace("__H__", "1350").replace("__PAD__", "40")
            .replace("__BANNER__", "620").replace("__GRAD__", GRADIENT)
            .replace("__HSIZE__", str(hsize(c["headline"]))) +
            f'<div class="canvas"><div class="glow"></div>'
            f'<div class="mast"><div class="mrule"></div><div class="mtitle">The Business Glossary</div><div class="mrule"></div></div>'
            f'<div class="card"><img class="banner" src="file://{img}"><div class="body">'
            f'<div class="headline">{c["headline"]}</div>{body}</div></div>'
            f'<div class="footzone"><div style="display:flex;flex-direction:column;align-items:center;gap:11px">'
            f'<div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>'
            f'<div class="cta">Download the Rehearsal app</div></div>' + FOOT)
    return html, 1080, 1350


def build_square(slug, c, img):
    # Extended body: first two brand-voice paragraphs (the ones carrying the
    # person/company names), with those names bolded white for scan emphasis.
    body = "\n".join(
        f'<div class="sqdef">{bolden(p, BOLD.get(slug, []))}</div>' for p in paras(c)[:2]
    )
    html = (HEAD.replace("__W__", "1080").replace("__H__", "1080").replace("__PAD__", "30")
            .replace("__BANNER__", "402").replace("__GRAD__", GRADIENT)
            .replace("__HSIZE__", str(hsize(c["headline"], big=False))) +
            f'<div class="canvas"><div class="glow"></div>'
            f'<div class="mast"><div class="mrule"></div><div class="mtitle">The Business Glossary</div><div class="mrule"></div></div>'
            f'<div class="card"><div class="bwrap">'
            f'<img class="bimg" src="file://{img}"></div><div class="body">'
            f'<div class="headline">{c["headline"]}</div>{body}</div></div>'
            f'<div class="footzone"><div style="display:flex;flex-direction:column;align-items:center;gap:10px">'
            f'<div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>'
            f'<div class="cta">Download the Rehearsal app</div></div>' + FOOT)
    return html, 1080, 1080


BUILDERS = {"portrait": build_portrait, "square": build_square}


def main(argv):
    mode = argv[0] if argv and argv[0] in ("portrait", "square", "both") else "square"
    targets = [a for a in argv if a not in ("portrait", "square", "both")]
    modes = ["portrait", "square"] if mode == "both" else [mode]
    html_dir = HERE / "_html"; html_dir.mkdir(exist_ok=True)
    slugs = targets or list(CARDS.keys())
    for slug in slugs:
        c = CARDS[slug]
        img = VISUALS / c["course"] / c["image"]
        if not img.exists():
            print(f"  ! missing {img}", file=sys.stderr); continue
        for m in modes:
            html, w, h = BUILDERS[m](slug, c, img)
            suffix = "" if m == "portrait" else "-sq"
            html_out = html_dir / f"{slug}{suffix}.html"
            png_out = HERE / f"{slug}{suffix}.png"
            html_out.write_text(html)
            render(html_out, png_out, w, h)
            print(f"  IG {m:8s} {slug:20s} -> {png_out.name}  ({w}x{h})")


if __name__ == "__main__":
    main(sys.argv[1:])
