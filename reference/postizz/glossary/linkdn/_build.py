"""Generate v5 LinkedIn glossary cards — v6 design (green "knowledge card").

v6 = the WhatsApp "knowledge card" LAYOUT (eyebrow masthead -> full-width course
image inside a rounded dark card -> rainbow headline -> engaging brand-voice body
with names bolded white -> centred Rehearsal wordmark -> green "Download the
Rehearsal app" button) rendered for LINKEDIN, with LinkedIn-native CAPTIONS
(brand-voice body + rotating close + plain App Store / Play / Web links +
hashtags). No "Forward this to..." line, no WhatsApp markdown.

Shares the SAME factual card data as the LinkedIn build (../_build.py CARDS) so
definitions, courses, images and verified facts never drift between platforms.
Platform/design-specific here = the LAYOUT (green card) and the CAPTION (LinkedIn).

Render: headless Chrome screenshot, 1080x1350 (4:5 LinkedIn portrait).
"""
import importlib.util
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent              # postizz/glossary/linkdn
GLOSSARY = HERE.parent                    # postizz/glossary  (shared data lives here)
ROOT = HERE.parents[2]                    # repo root (linkdn -> glossary -> postizz -> root)
VISUALS = ROOT / "visuals"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GRADIENT = "linear-gradient(90deg,#9677f8 0%,#4e44fd 33%,#ff4859 66%,#00c483 100%)"
LINKS = (
    "iOS: https://apps.apple.com/in/app/try-rehearsal-ai/id6762619041\n"
    "Android: https://play.google.com/store/apps/details?id=ai.rehearsal.app\n"
    "Web: https://rehearsal.gradeless.ai/"
)

_meta_spec = importlib.util.spec_from_file_location("social_meta", GLOSSARY / "_social_meta.py")
_meta = importlib.util.module_from_spec(_meta_spec)
_meta_spec.loader.exec_module(_meta)
bolden = _meta.bolden

# Canonical glossary card data (merges _cards_ext for the Jun14–Jul2 extension).
_cards_spec = importlib.util.spec_from_file_location("cards_v6", GLOSSARY / "_cards_v6.py")
_cards = importlib.util.module_from_spec(_cards_spec)
_cards_spec.loader.exec_module(_cards)
CARDS, BOLD = _cards.NEW_CARDS, _cards.BOLD_V6


def body_paras(c: dict) -> list:
    """opener + up to 3 more brand-voice paragraphs. Capped so the card doesn't
    overflow on the 4:5 canvas."""
    parts = [p.strip() for p in c["explanation"].split("\n\n") if p.strip()]
    return parts[:4]


def li_caption(c: dict) -> str:
    """LinkedIn-native caption: full brand-voice explanation, rotating close,
    plain download links, hashtags. (Mirrors the v5 LinkedIn MD caption.)"""
    return f"{c['explanation']}\n\n{c['close']}\n\n{LINKS}\n\n{c['hashtags']}"


def hsize(headline: str) -> int:
    n = len(headline)
    if n <= 10:
        return 70
    if n <= 13:
        return 62
    if n <= 20:
        return 54
    if n <= 26:
        return 46
    return 40


HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;background:#0a0a0c;overflow:hidden;font-family:'Raleway',sans-serif;color:#fff}
.canvas{position:relative;width:1080px;height:1350px;overflow:hidden;background:#0a0a0c;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:40px 0 32px}
.glow{position:absolute;top:-150px;left:50%;transform:translateX(-50%);width:1240px;height:720px;z-index:0;
  background:radial-gradient(ellipse at center,rgba(0,196,131,0.18) 0%,rgba(0,196,131,0.05) 45%,transparent 72%)}
.mast{position:relative;z-index:3;display:flex;align-items:center;gap:16px;margin-bottom:18px}
.mast .mrule{width:42px;height:4px;border-radius:2px;background:__GRAD__}
.mast .mtitle{font-weight:800;font-size:27px;letter-spacing:6px;text-transform:uppercase;color:#fff}
/* square card */
.card{position:relative;z-index:3;width:1004px;border-radius:40px;background:#141418;
  border:1px solid rgba(0,196,131,0.28);overflow:hidden;box-shadow:0 40px 110px rgba(0,0,0,0.6)}
/* banner: full-width, edge-to-edge */
.banner{display:block;width:100%;height:620px;object-fit:cover;background:#0f0f12}
.body{padding:28px 46px 30px}
.headline{font-weight:900;font-size:__HSIZE__px;line-height:0.98;letter-spacing:-2px;
  background:__GRAD__;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent}
.def{margin-top:15px;font-weight:300;font-size:26px;line-height:1.4;color:#d6dae1}
.def b{font-weight:800;color:#fff}
/* bottom — wordmark + button, centred in the space below the card */
.footzone{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:17px}
.foot{display:flex;flex-direction:column;align-items:center;gap:11px}
.wm{font-family:'Raleway',sans-serif;font-weight:400;font-size:48px;letter-spacing:-1.1px;line-height:0.9;color:#fff}
.wm span{font-weight:200}
.wmline{width:158px;height:5px;border-radius:3px;background:__GRAD__}
.cta{display:inline-flex;align-items:center;gap:12px;background:#00c483;color:#06231a;
  font-weight:800;font-size:25px;letter-spacing:0.3px;padding:17px 40px;border-radius:100px}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.022) 1px,transparent 1px);
  background-size:3px 3px;opacity:0.4;pointer-events:none;z-index:5}
.stripe{position:absolute;left:0;bottom:0;width:100%;height:8px;background:__GRAD__;z-index:6}
</style></head><body>
<div class="canvas">
  <div class="glow"></div>
  <div class="mast">
    <div class="mrule"></div>
    <div class="mtitle">The Business Glossary</div>
    <div class="mrule"></div>
  </div>
  <div class="card">
    <img class="banner" src="file://__IMAGE__">
    <div class="body">
      <div class="headline">__HEADLINE__</div>
      __BODY__
    </div>
  </div>
  <div class="footzone">
    <div class="foot">
      <div class="wm">Re<span>hearsal</span></div>
      <div class="wmline"></div>
    </div>
    <div class="cta">Download the Rehearsal app</div>
  </div>
  <div class="grain"></div><div class="stripe"></div>
</div></body></html>"""

MD = """# {slug} — LinkedIn (v6 green card)

**Platform:** LinkedIn (1080×1350, 4:5 portrait)
**Pillar:** glossary (v5 · brand-voice · v6 design)
**Voice:** Rehearsal calm-authoritative documentary observer (per final_video/social-media-pillars-2026-05)
**Layout:** `card_4x5_green` — "The Business Glossary" masthead; a rounded dark card whose top is the full-width course image, then the rainbow headline and engaging brand-voice paragraphs (names bolded white); below the card, a centred Rehearsal wordmark with a centred "Download the Rehearsal app →" button on a soft green glow. Same knowledge-card layout as WhatsApp, LinkedIn caption.
**Course:** `{course}`
**Image:** `visuals/{course}/{image}`
**Render:** `{slug}.png`

## On-card copy

- **Masthead:** The Business Glossary
- **Headline (rainbow-filled):** {headline}
- **Body (brand-voice, engaging; company/personality named in the prose):**

{body}

- **Footer:** centred Rehearsal wordmark, then a centred "Download the Rehearsal app →" button · rainbow stripe

## Suggested caption (LinkedIn-native — brand voice + links + hashtags)

{caption}
"""


def render(html_path: Path, png_path: Path):
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        "--window-size=1080,1350", "--virtual-time-budget=9000",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={png_path}", f"file://{html_path}",
    ], check=True, capture_output=True)


def main(targets):
    html_dir = HERE / "_html"
    html_dir.mkdir(exist_ok=True)
    cards = [c for c in CARDS if not targets or c["slug"] in targets]
    for c in cards:
        img = VISUALS / c["course"] / c["image"]
        if not img.exists():
            print(f"  ! MISSING image: {img}", file=sys.stderr)
            continue
        paras = body_paras(c)[:3]
        body_html = "\n      ".join(
            f'<div class="def">{bolden(p, BOLD.get(c["slug"], []))}</div>' for p in paras
        )
        html = (HTML
                .replace("__IMAGE__", str(img))
                .replace("__GRAD__", GRADIENT)
                .replace("__HEADLINE__", c["headline"])
                .replace("__BODY__", body_html)
                .replace("__HSIZE__", str(hsize(c["headline"]))))
        html_out = html_dir / f"{c['slug']}.html"
        png_out = HERE / f"{c['slug']}.png"
        html_out.write_text(html)
        body_plain = "\n\n".join(paras)
        (HERE / f"{c['slug']}.md").write_text(MD.format(
            slug=c["slug"], course=c["course"], image=c["image"],
            headline=c["headline"], body=body_plain, caption=li_caption(c),
        ))
        render(html_out, png_out)
        print(f"  v6 {c['slug']:16s} {c['course']}/{c['image']}  -> {png_out.name}")


if __name__ == "__main__":
    main(sys.argv[1:])
