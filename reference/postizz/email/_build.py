"""Rehearsal email-header banner samples (standard 600px email width @2x = 1200px).

Rehearsal-branded (we partner with Jaipuria — small partner line only, no Jaipuria
lockup). Dark brand aesthetic + one light variant for light email templates.

Render: headless Chrome screenshot. Output PNGs display at 600px wide in email.

Usage:  python3 _build.py            # all concepts
        python3 _build.py edge       # one concept by key
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GRAD = "linear-gradient(90deg,#9677f8 0%,#4e44fd 33%,#ff4859 66%,#00c483 100%)"

# 2x canvas: 1200x400 displays as 600x200 (standard email header banner)
W, H = 1200, 400

FONT = ('<link href="https://fonts.googleapis.com/css2?'
        'family=Raleway:wght@200;300;400;600;700;800;900&display=swap" rel="stylesheet">')

BASE = """<!DOCTYPE html><html><head><meta charset="utf-8">__FONT__
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:__W__px;height:__H__px;overflow:hidden;font-family:'Raleway',sans-serif}
.b{position:relative;width:__W__px;height:__H__px;overflow:hidden;display:flex;align-items:center;
   padding:0 70px;__BG__}
.glow{position:absolute;top:-220px;left:__GX__;width:900px;height:560px;z-index:0;
  background:radial-gradient(ellipse at center,rgba(0,196,131,0.20) 0%,rgba(0,196,131,0.04) 50%,transparent 72%)}
.col{position:relative;z-index:2;display:flex;flex-direction:column}
.eyebrow{font-weight:800;font-size:21px;letter-spacing:5px;text-transform:uppercase;color:__EYE__;margin-bottom:14px}
.h1{font-weight:900;font-size:__HS__px;line-height:0.98;letter-spacing:-1.5px;color:__INK__}
.h1 .g{background:__GRAD__;-webkit-background-clip:text;-webkit-text-fill-color:transparent;
   background-clip:text;color:transparent}
.sub{margin-top:16px;font-weight:300;font-size:25px;line-height:1.32;color:__SUB__;max-width:660px}
.sub b{font-weight:700;color:__INK__}
.cta{display:inline-flex;align-items:center;gap:10px;background:#00c483;color:#06231a;
  font-weight:800;font-size:23px;letter-spacing:0.2px;padding:16px 34px;border-radius:100px;width:fit-content}
.right{position:relative;z-index:2;margin-left:auto;display:flex;flex-direction:column;
  align-items:flex-end;justify-content:center;gap:18px;text-align:right}
.wm{font-weight:400;font-size:52px;letter-spacing:-1.2px;line-height:0.9;color:__INK__}
.wm span{font-weight:200}
.wmline{width:150px;height:5px;border-radius:3px;background:__GRAD__}
.chip{display:inline-flex;align-items:center;gap:9px;border:1.5px solid __CHIPB__;color:__INK__;
  font-weight:700;font-size:18px;letter-spacing:0.3px;padding:9px 20px;border-radius:100px}
.dot{width:9px;height:9px;border-radius:50%;background:#00c483;box-shadow:0 0 12px #00c483}
.partner{margin-top:18px;font-weight:600;font-size:16px;letter-spacing:1.5px;text-transform:uppercase;color:__PART__}
.stripe{position:absolute;left:0;bottom:0;width:100%;height:7px;background:__GRAD__;z-index:5}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.02) 1px,transparent 1px);
  background-size:3px 3px;opacity:0.5;pointer-events:none;z-index:4}
</style></head><body>__BODY__</body></html>"""

DARK = dict(BG="background:#0a0a0c", INK="#ffffff", SUB="#c9ced6", EYE="#00c483",
            CHIPB="rgba(255,255,255,0.22)", PART="#8b909a", GX="58%", grain='<div class="grain"></div>')
LIGHT = dict(BG="background:#ffffff", INK="#0a0a0c", SUB="#4a4f57", EYE="#00a06b",
             CHIPB="rgba(10,10,12,0.16)", PART="#8b909a", GX="60%", grain="")


def wordmark_block(theme, chip="Batch starts 29 June", cta="Try free → tryrehearsal.ai"):
    return (f'<div class="right"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:11px">'
            f'<div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>'
            f'<div class="chip"><span class="dot"></span>{chip}</div>'
            f'<div class="cta">{cta}</div></div>')


def banner(theme, eyebrow, headline_html, sub_html, hs=58, partner=True,
           chip="Batch starts 29 June", cta="Try free → tryrehearsal.ai"):
    glow = '' if theme is LIGHT else f'<div class="glow"></div>'
    part = f'<div class="partner">In partnership with Jaipuria Institute of Management</div>' if partner else ''
    body = (f'<div class="b">{glow}'
            f'<div class="col"><div class="eyebrow">{eyebrow}</div>'
            f'<div class="h1">{headline_html}</div>'
            f'<div class="sub">{sub_html}</div>{part}</div>'
            f'{wordmark_block(theme, chip, cta)}'
            f'{theme["grain"]}<div class="stripe"></div></div>')
    html = BASE.replace("__FONT__", FONT).replace("__W__", str(W)).replace("__H__", str(H))
    for k, v in {"__BG__": theme["BG"], "__INK__": theme["INK"], "__SUB__": theme["SUB"],
                 "__EYE__": theme["EYE"], "__CHIPB__": theme["CHIPB"], "__PART__": theme["PART"],
                 "__GX__": theme["GX"], "__GRAD__": GRAD, "__HS__": str(hs)}.items():
        html = html.replace(k, v)
    return html.replace("__BODY__", body)


# --- concepts --------------------------------------------------------------
CONCEPTS = {
    "notes": lambda: banner(
        DARK, "New · Voice Notes",
        'Notes that<br><span class="g">talk back.</span>',
        'Tap the mic, talk. AI writes the summary and takeaways — <b>in your own words.</b>',
        hs=58, partner=False,
        chip="New in the app", cta="Record your first note"),
    "notes-saidit": lambda: banner(
        DARK, "New · Voice Notes",
        'Save it. Sound like<br><span class="g">you said it.</span>',
        'Tap the mic, talk. AI writes the summary and takeaways — <b>in your own words.</b>',
        hs=52, partner=False,
        chip="New in the app", cta="Record your first note"),
    "edge": lambda: banner(
        DARK, "The Rehearsal Edge",
        'Rehearse for <span class="g">months.</span><br>Not the night before.',
        'AI mock interviews that know your CV — and put <b>your own numbers</b> back in your mouth.',
        hs=56),
    "hireable": lambda: banner(
        DARK, "AI Interview Prep · From Day 1",
        'Become the person<br>recruiters <span class="g">want to hire.</span>',
        'Real company stories. AI mock interviews. Practice until confidence is second nature.',
        hs=54),
    "think": lambda: banner(
        DARK, "Free for Students",
        'Think on your feet.<br><span class="g">Say the right thing.</span>',
        'The one skill most MBA students lack when they face a recruiter — <b>rehearsed</b>.',
        hs=56),
    "light": lambda: banner(
        LIGHT, "AI Interview Prep · From Day 1",
        'Rehearse for <span class="g">months.</span><br>Not the night before.',
        'Real company stories. AI mock interviews that know your CV.',
        hs=56),
}


def render(html_path, png_path):
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        f"--window-size={W},{H}", "--virtual-time-budget=9000",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={png_path}", f"file://{html_path}",
    ], check=True, capture_output=True)


def main(targets):
    html_dir = HERE / "_html"; html_dir.mkdir(exist_ok=True)
    keys = targets or list(CONCEPTS.keys())
    for k in keys:
        html = CONCEPTS[k]()
        html_out = html_dir / f"banner-{k}.html"; html_out.write_text(html)
        png_out = HERE / f"banner-{k}.png"
        render(html_out, png_out)
        print(f"  banner-{k:10s} -> {png_out.name}  ({W}x{H}, displays 600x200)")


if __name__ == "__main__":
    main(sys.argv[1:])
