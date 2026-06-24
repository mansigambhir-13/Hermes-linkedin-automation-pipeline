"""Rehearsal × Jaipuria vertical posters / standees — 1080x1920 (9:16).

v1.1 changes:
  - kicker  -> "Free Pro Tier for all Jaipuria students & staff"
  - QR codes enlarged (196 -> 300px) for easier scanning
  - store labels replaced with Apple / Google Play LOGOS (inline SVG, white)
  - "Download the app now" button reduced (full-width 42px -> auto-width 32px)

One shared template; 10 headlines. Re-render: python3 _build.py [slug ...]
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent                 # posters/v1
QRDIR = HERE.parents[1] / "_samples"         # hoardings/_samples
QR_IOS = QRDIR / "qr-ios.png"        # black-on-white — clean on the white chip
QR_AND = QRDIR / "qr-android.png"
ROOT = HERE.parents[3]               # repo root (v1 -> posters -> hoardings -> postizz -> root)
VISUALS = ROOT / "visuals"

# slug -> (course folder, css object-position for the 912x470 crop)
# Deliberate palette rotation across the set: blue, orange/black, cream/red,
# chess-dark, navy-grid, crimson, yellow, cream/rings, isometric, molten gold.
POSTER_VISUALS = {
    "counts":         ("corporate-strategist-partnership-crisis", "center 26%"),
    "said-it":        ("founder-agent-readiness",                 "center 50%"),
    "scribbles":      ("strategic-analyst-thesis-construction",   "center 55%"),
    "second-brain":   ("senior-leader-centaur-design",            "center 35%"),
    "sharp-tomorrow": ("territory-sales-manager-beat-planning",   "center 50%"),
    "sharper":        ("retail-investor-crisis-investing",        "center 45%"),
    "smarter":        ("brand-manager-market-positioning",        "center 50%"),
    "talk-back":      ("marketing-manager-trust-architecture",    "center 45%"),
    "working":        ("operations-manager-hub-placement",        "center 50%"),
    "you-know":       ("founder-category-creation",               "center 40%"),
}
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

KICKER = "Free Pro Tier for all Jaipuria students &amp; staff"
SUB = ("Rehearsal AI keeps everything you save and turns it into answers that "
       "sound just like you. Assignments, presentations, interviews. "
       "Everything becomes easier with Rehearsal.")

# slug -> (white line, rainbow line)
HEADLINES = {
    "counts":         ("Save like", "it counts."),
    "said-it":        ("Save it.", "Sound like you said it."),
    "scribbles":      ("From scribbles", "to answers."),
    "second-brain":   ("Your second brain,", "finally yours."),
    "sharp-tomorrow": ("Saved today.", "Sharp tomorrow."),
    "sharper":        ("Every idea saved", "makes you sharper."),
    "smarter":        ("Become smarter", "with every save."),
    "talk-back":      ("Notes that", "talk back."),
    "working":        ("Everything you save,", "working for you."),
    "you-know":       ("What you save,", "you know."),
}

# inline store logos (white, monochrome — premium on dark)
APPLE = ('<svg viewBox="0 0 384 512" height="38" fill="#ffffff" aria-label="Apple"><path d="'
         'M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 '
         '20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 '
         '107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-'
         '65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 '
         '34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>')
PLAY = ('<svg viewBox="0 0 512 512" height="34" fill="#ffffff" aria-label="Android"><path d="'
        'M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 '
        '28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 '
        '18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>')

HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:#060607;font-family:'Raleway',sans-serif;color:#fff;overflow:hidden}
.s{position:relative;width:1080px;height:1920px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;padding:88px 84px 72px}
.bg{position:absolute;inset:0;z-index:0;background:
  radial-gradient(900px 720px at 86% 22%,rgba(150,119,248,0.16),transparent 56%),
  radial-gradient(840px 660px at 12% 84%,rgba(0,196,131,0.14),transparent 60%)}
.top{position:relative;z-index:3}
.logo{font-weight:400;font-size:90px;letter-spacing:-2.4px;color:#fff;line-height:0.9}.logo span{font-weight:200}
.u{width:100%;height:9px;border-radius:5px;margin-top:15px;background:linear-gradient(90deg,#9677f8,#4e44fd,#ff4859,#00c483)}
.kick{margin-top:24px;font-weight:800;font-size:25px;letter-spacing:2.4px;text-transform:uppercase;color:#13e3a0;line-height:1.3;max-width:912px}
.mid{position:relative;z-index:3}
.head{font-weight:900;font-size:100px;line-height:0.97;letter-spacing:-0.04em;padding-bottom:8px}
.head .rb{background:linear-gradient(90deg,#9677f8,#4e44fd,#ff4859,#00c483);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
/* full-bleed composited scene — image dissolves into the canvas, no card edges */
.vis{position:relative;margin:6px 0 0 -84px;width:1080px;height:560px;overflow:hidden}
.vis img{width:100%;height:100%;object-fit:cover;object-position:__VPOS__;display:block;
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 80%,transparent 99%);
  mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 80%,transparent 99%)}
.vis .fx{position:absolute;inset:0;background:
  linear-gradient(90deg,#060607 0%,rgba(6,6,7,0) 16%,rgba(6,6,7,0) 84%,#060607 100%),
  linear-gradient(180deg,rgba(6,6,7,0.55) 0%,rgba(6,6,7,0) 24%,rgba(6,6,7,0) 70%,rgba(6,6,7,0.92) 100%)}
.sub{margin-top:6px;font-weight:600;font-size:31px;line-height:1.42;color:#dfe3e9;max-width:912px}
.bot{position:relative;z-index:3;width:100%}
.qrs{display:flex;gap:32px;justify-content:center}
.qr{display:flex;flex-direction:column;align-items:center;gap:18px;background:#101016;
  border:1px solid rgba(255,255,255,0.10);border-radius:30px;padding:24px 26px 26px}
.qrhead{display:flex;align-items:center;gap:14px;height:40px}
.qrhead .ico{display:flex;align-items:center}
.qrhead .nm{font-weight:800;font-size:34px;letter-spacing:-0.6px;color:#fff}
.chip{background:#fff;border-radius:20px;padding:18px;box-shadow:0 14px 34px rgba(0,0,0,0.40)}
.chip img{width:248px;height:248px;display:block}
.ctawrap{text-align:center}
.cta{display:inline-block;margin-top:30px;background:#00c483;color:#06231a;font-weight:800;
  font-size:31px;padding:21px 54px;border-radius:100px;box-shadow:0 18px 44px rgba(0,196,131,0.32)}
.stripe{position:absolute;left:0;bottom:0;width:100%;height:12px;background:linear-gradient(90deg,#9677f8,#4e44fd,#ff4859,#00c483);z-index:6}
</style></head><body>
<div class="s"><div class="bg"></div>
  <div class="top"><div class="logo">Re<span>hearsal</span></div><div class="u"></div>
    <div class="kick">__KICKER__</div></div>
  <div class="mid"><div class="head">__L1__<br><span class="rb">__L2__</span></div>
    <div class="vis"><img src="file://__VISUAL__"><div class="fx"></div></div>
    <div class="sub">__SUB__</div></div>
  <div class="bot">
    <div class="qrs">
      <div class="qr"><div class="qrhead"><div class="ico">__APPLE__</div><div class="nm">Apple</div></div><div class="chip"><img src="file://__QR_IOS__"></div></div>
      <div class="qr"><div class="qrhead"><div class="ico">__PLAY__</div><div class="nm">Android</div></div><div class="chip"><img src="file://__QR_AND__"></div></div>
    </div>
    <div class="ctawrap"><div class="cta">Download the app now</div></div>
  </div>
  <div class="stripe"></div>
</div></body></html>"""


def render(html_path, png_path):
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        "--window-size=1080,1920", "--virtual-time-budget=9000",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={png_path}", f"file://{html_path}",
    ], check=True, capture_output=True)


def main(targets):
    html_dir = HERE / "_html"; html_dir.mkdir(exist_ok=True)
    slugs = [s for s in HEADLINES if not targets or s in targets]
    for slug in slugs:
        l1, l2 = HEADLINES[slug]
        course, vpos = POSTER_VISUALS[slug]
        visual = VISUALS / course / "visual-0-cover.png"
        if not visual.exists():
            print(f"  ! MISSING visual: {visual}", file=sys.stderr); continue
        html = (HTML.replace("__KICKER__", KICKER).replace("__SUB__", SUB)
                .replace("__L1__", l1).replace("__L2__", l2)
                .replace("__APPLE__", APPLE).replace("__PLAY__", PLAY)
                .replace("__VISUAL__", str(visual)).replace("__VPOS__", vpos)
                .replace("__QR_IOS__", str(QR_IOS)).replace("__QR_AND__", str(QR_AND)))
        html_out = html_dir / f"{slug}.html"; html_out.write_text(html)
        png_out = HERE / f"{slug}.png"
        render(html_out, png_out)
        print(f"  poster {slug:16s} -> {png_out.name}")
    print(f"\n  done ({len(slugs)} posters)")


if __name__ == "__main__":
    main(sys.argv[1:])
