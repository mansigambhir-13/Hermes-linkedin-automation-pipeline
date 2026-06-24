"""Render the 'MBA Jargon' marketing Term-1 cards (clean modern design).

Each card = MBA JARGON masthead + subject pill + a marketing-course image +
rainbow-headline term + one-line definition + a clean framework DIAGRAM
(grid / steps / funnel / pyramid / curve / versus / focus) + web-verified origin
note. LinkedIn 1080x1350. Images pulled from repo visuals/.
"""
import html as _html
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]                      # repo root (jargons -> postizz -> root)
VISUALS = ROOT / "visuals"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
RB = "linear-gradient(90deg,#9677f8,#4e44fd,#ff4859,#00c483)"
SUBJECT = {"marketing": "#ff4859"}
PAL = ["#9677f8", "#4e44fd", "#ff4859", "#00c483"]


def esc(s): return _html.escape(s)


# --- diagram renderers -----------------------------------------------------
def d_grid(items):  # 4x [label, sub]
    cells = ""
    for i, (l, s) in enumerate(items):
        cells += (f'<div class="cell" style="--c:{PAL[i]}"><div class="pi">{chr(9679)}</div>'
                  f'<div><div class="cl">{esc(l)}</div><div class="cs">{esc(s)}</div></div></div>')
    return f'<div class="dgrid">{cells}</div>'


def d_steps(items):  # [label, sub] horizontal numbered
    seg = []
    for i, (l, s) in enumerate(items):
        seg.append(f'<div class="step"><div class="num" style="--c:{PAL[i]}">{i+1}</div>'
                   f'<div class="sl">{esc(l)}</div><div class="ss">{esc(s)}</div></div>')
        if i < len(items) - 1:
            seg.append('<div class="arrow">&rarr;</div>')
    return f'<div class="steps">{"".join(seg)}</div>'


def d_funnel(items):  # narrowing tiers
    n = len(items); tiers = ""
    for i, (l, s) in enumerate(items):
        w = 100 - i * (38 / max(1, n - 1))
        tiers += (f'<div class="tier" style="width:{w:.0f}%;--c:{PAL[i % 4]}">'
                  f'<span class="tl">{esc(l)}</span><span class="ts">{esc(s)}</span></div>')
    return f'<div class="funnel">{tiers}</div>'


def d_pyramid(items):  # widest at bottom; items bottom->top
    n = len(items); tiers = ""
    for i, (l, s) in enumerate(items):          # i=0 bottom (widest)
        w = 100 - (n - 1 - i) * (52 / max(1, n - 1))
        tiers += (f'<div class="ptier" style="width:{w:.0f}%;--c:{PAL[(n-1-i) % 4]}">'
                  f'<span class="tl">{esc(l)}</span><span class="ts">{esc(s)}</span></div>')
    return f'<div class="pyr">{tiers}</div>'


def d_curve(phases):  # PLC S-curve SVG + phase labels
    labels = "".join(f'<div class="ph" style="--c:{PAL[i % 4]}">{esc(p)}</div>' for i, p in enumerate(phases))
    svg = ('<svg viewBox="0 0 900 200" class="csvg" preserveAspectRatio="none">'
           '<defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="0">'
           '<stop offset="0" stop-color="#9677f8"/><stop offset="0.4" stop-color="#4e44fd"/>'
           '<stop offset="0.72" stop-color="#ff4859"/><stop offset="1" stop-color="#00c483"/></linearGradient></defs>'
           '<path d="M10,180 C220,180 250,40 470,35 C600,32 640,40 700,70 C780,110 840,150 890,178" '
           'fill="none" stroke="url(#cg)" stroke-width="6" stroke-linecap="round"/></svg>')
    return f'<div class="curve">{svg}<div class="phases">{labels}</div></div>'


def d_versus(a, b):
    def col(d, side):
        return (f'<div class="vcol" style="--c:{d["c"]}"><div class="vt">{esc(d["title"])}</div>'
                f'<div class="vl">{esc(d["line"])}</div></div>')
    return f'<div class="versus">{col(a,0)}<div class="vx">vs</div>{col(b,1)}</div>'


def d_focus(items):  # bars, one highlighted (USP)
    bars = ""
    for l, you in items:
        cls = "fbar you" if you else "fbar"
        bars += f'<div class="{cls}"><span>{esc(l)}</span></div>'
    return f'<div class="focus">{bars}</div>'


DIAG = {"grid": d_grid, "steps": d_steps, "funnel": d_funnel,
        "pyramid": d_pyramid, "curve": d_curve, "versus": d_versus, "focus": d_focus}

# --- cards -----------------------------------------------------------------
CARDS = [
 {"slug":"4ps","headline":"The 4 Ps","img":"brand-manager-market-positioning/visual-0-cover.png",
  "def":"The four levers every marketer controls: Product, Price, Place, Promotion.",
  "diag":("grid",[("Product","what you make"),("Price","what you charge"),("Place","where you sell"),("Promotion","how you tell")]),
  "note":"Coined by <b>E. Jerome McCarthy</b> in 1960, popularised by <b>Philip Kotler</b>. Change one P and the other three have to answer for it."},
 {"slug":"4cs","headline":"The 4 Cs","img":"brand-manager-market-positioning/visual-1.png",
  "def":"The 4 Ps rewritten from the buyer's side of the table.",
  "diag":("grid",[("Customer","the need, not the product"),("Cost","total cost to buy"),("Convenience","ease of buying"),("Communication","a dialogue, not ads")]),
  "note":"Proposed by <b>Robert Lauterborn</b> in 1990 as a customer-first answer to the 4 Ps."},
 {"slug":"stp","headline":"STP","img":"brand-manager-market-positioning/visual-2.png",
  "def":"Going to market in three moves: segment, target, position.",
  "diag":("steps",[("Segmentation","split the market"),("Targeting","pick who to serve"),("Positioning","own a place in their head")]),
  "note":"The backbone of modern marketing strategy, popularised by <b>Philip Kotler</b>. You cannot position until you have chosen who to ignore."},
 {"slug":"product-life-cycle","headline":"Product Life Cycle","img":"brand-manager-downward-brand-extension/visual-0-cover.png",
  "def":"Every product moves through four stages, and each one needs a different playbook.",
  "diag":("curve",["Introduction","Growth","Maturity","Decline"]),
  "note":"Framed by <b>Theodore Levitt</b> in HBR, 1965. The strategy that wins in Growth quietly kills you in Maturity."},
 {"slug":"aida","headline":"AIDA","img":"marketing-manager-message-framing/visual-0-cover.png",
  "def":"How a stranger becomes a buyer: Attention, Interest, Desire, Action.",
  "diag":("funnel",[("Attention","get noticed"),("Interest","earn a look"),("Desire","make them want it"),("Action","close")]),
  "note":"One of advertising's oldest models, traced to <b>Elias St. Elmo Lewis</b> around 1898."},
 {"slug":"brand-equity","headline":"Brand Equity","img":"brand-manager-downward-brand-extension/visual-1.png",
  "def":"The extra value a name carries, beyond the product itself.",
  "diag":("pyramid",[("Identity","who are you?"),("Meaning","what are you?"),("Response","what do I think?"),("Resonance","you and me")]),
  "note":"Brand equity was systematised by <b>David Aaker</b> (1991); the loyalty pyramid is <b>Kevin Keller's</b> CBBE model (1993)."},
 {"slug":"marketing-funnel","headline":"The Marketing Funnel","img":"marketing-manager-message-framing/visual-2.png",
  "def":"The shrinking path from everyone who hears of you to everyone who stays.",
  "diag":("funnel",[("Awareness","they hear of you"),("Consideration","they weigh you"),("Conversion","they buy"),("Loyalty","they return")]),
  "note":"A descendant of <b>AIDA</b> (Lewis, 1898). Every stage leaks; the skill is knowing which leak costs the most."},
 {"slug":"penetration-vs-skimming","headline":"Penetration vs Skimming","img":"brand-manager-downward-brand-extension/visual-2.png",
  "def":"Two opposite ways to price something new.",
  "diag":("versus",{"c":"#00c483","title":"Penetration","line":"Enter low. Win volume fast. Raise later."},
                   {"c":"#ff4859","title":"Skimming","line":"Enter high. Harvest early adopters. Lower over time."}),
  "note":"The classic new-product trade-off, framed by <b>Joel Dean</b> in HBR, 1950."},
 {"slug":"market-segmentation","headline":"Market Segmentation","img":"brand-manager-market-positioning/visual-3.png",
  "def":"Cutting one big market into groups that actually behave alike.",
  "diag":("grid",[("Demographic","age, income, gender"),("Geographic","where they live"),("Psychographic","values, lifestyle"),("Behavioural","how they buy and use")]),
  "note":"The foundational idea comes from <b>Wendell Smith</b>, 1956. A segment you cannot reach or measure is not a segment."},
 {"slug":"usp","headline":"The USP","img":"marketing-manager-message-framing/visual-3.png",
  "def":"The one true thing only you can say, that the buyer actually cares about.",
  "diag":("focus",[("“us too”",False),("“us too”",False),("“us too”",False),("only we can say this",True)]),
  "note":"Coined by adman <b>Rosser Reeves</b> in 1961. If a rival can say it too, it is not unique."},
]

STYLE = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;background:#0a0a0c;font-family:'Raleway',sans-serif;color:#fff;overflow:hidden}
.canvas{position:relative;width:1080px;height:1350px;display:flex;flex-direction:column;align-items:center;padding:46px 0 34px}
.glow{position:absolute;top:-160px;left:50%;transform:translateX(-50%);width:1200px;height:660px;z-index:0;
  background:radial-gradient(ellipse at center,__GLOW__ 0%,transparent 72%)}
.mast{position:relative;z-index:3;font-weight:800;font-size:24px;letter-spacing:7px;text-transform:uppercase;color:#fff;margin-bottom:20px}
.chip{position:relative;z-index:3;margin-bottom:24px;display:inline-flex;align-items:center;gap:11px;
  font-weight:700;font-size:20px;letter-spacing:2.5px;text-transform:uppercase;color:__SUBL__;
  background:__SUBBG__;border-radius:100px;padding:9px 22px}
.chip .dot{width:9px;height:9px;border-radius:50%;background:__SUB__}
.card{position:relative;z-index:3;width:1004px;border-radius:44px;background:#131318;border:1px solid rgba(255,255,255,0.06);
  overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,0.55)}
.banner{display:block;width:100%;height:392px;object-fit:cover;background:#0f0f12}
.body{padding:36px 50px 42px}
.headline{font-weight:900;font-size:__HS__px;line-height:0.96;letter-spacing:-2.5px;color:__SUB__}
.def{margin-top:16px;font-weight:600;font-size:29px;line-height:1.34;color:#f4f5f7;max-width:880px}
.diag{margin-top:30px}
.note{margin-top:30px;font-weight:300;font-size:23px;line-height:1.46;color:#b9bdc6}.note b{font-weight:700;color:#f4f5f7}
/* grid */
.dgrid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,0.08)}
.cell{display:flex;align-items:center;gap:16px;padding:24px 8px}
.cell:nth-child(odd){border-right:1px solid rgba(255,255,255,0.08);padding-right:26px}
.cell:nth-child(even){padding-left:30px}
.cell:nth-child(1),.cell:nth-child(2){border-bottom:1px solid rgba(255,255,255,0.08)}
.cell .pi{font-size:34px;line-height:0.8;color:var(--c)}
.cell .cl{font-weight:700;font-size:27px;color:#f4f5f7;letter-spacing:-0.3px}.cell .cs{font-weight:300;font-size:18px;color:#8b909b;margin-top:2px}
/* steps */
.steps{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}
.step{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center}
.step .num{width:64px;height:64px;border-radius:50%;border:2px solid var(--c);color:var(--c);font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center}
.step .sl{margin-top:14px;font-weight:700;font-size:25px;color:#f4f5f7}.step .ss{font-weight:300;font-size:18px;color:#8b909b;margin-top:3px}
.arrow{align-self:center;margin-top:18px;color:#5a5f6a;font-size:34px}
/* funnel */
.funnel{display:flex;flex-direction:column;align-items:center;gap:9px}
.tier{height:64px;border-radius:12px;background:#15151c;border-left:5px solid var(--c);display:flex;align-items:center;justify-content:space-between;padding:0 26px}
.tier .tl{font-weight:700;font-size:25px;color:#f4f5f7}.tier .ts{font-weight:300;font-size:18px;color:#8b909b}
/* pyramid */
.pyr{display:flex;flex-direction:column-reverse;align-items:center;gap:9px}
.ptier{height:62px;border-radius:12px;background:#15151c;border-left:5px solid var(--c);display:flex;align-items:center;justify-content:space-between;padding:0 26px}
.ptier .tl{font-weight:700;font-size:24px;color:#f4f5f7}.ptier .ts{font-weight:300;font-size:17px;color:#8b909b}
/* curve */
.curve{margin-top:6px}.csvg{width:100%;height:190px;display:block}
.phases{display:flex;justify-content:space-between;margin-top:8px}
.ph{font-weight:700;font-size:22px;color:#f4f5f7;border-top:3px solid var(--c);padding-top:8px}
/* versus */
.versus{display:flex;align-items:stretch;gap:18px}
.vcol{flex:1;border-radius:18px;background:#15151c;border-top:4px solid var(--c);padding:24px 26px}
.vcol .vt{font-weight:800;font-size:30px;color:var(--c)}.vcol .vl{margin-top:10px;font-weight:300;font-size:23px;line-height:1.35;color:#d4d7dd}
.vx{align-self:center;font-weight:800;font-size:26px;color:#5a5f6a}
/* focus */
.focus{display:flex;flex-direction:column;gap:12px}
.fbar{height:60px;border-radius:12px;background:#15151c;display:flex;align-items:center;padding:0 26px;font-weight:600;font-size:24px;color:#7b808b;width:70%}
.fbar.you{background:rgba(255,72,89,0.14);color:#fff;font-weight:800;width:100%;border-left:5px solid #ff4859}
/* footer */
.footzone{position:relative;z-index:3;flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.wm{font-weight:400;font-size:46px;letter-spacing:-1.1px;color:#fff}.wm span{font-weight:200}
.wmline{width:152px;height:5px;border-radius:3px;background:__RB__}
.cta{display:inline-flex;background:#00c483;color:#06231a;font-weight:800;font-size:24px;padding:17px 40px;border-radius:100px}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.02) 1px,transparent 1px);background-size:3px 3px;opacity:0.35;pointer-events:none;z-index:5}
.stripe{position:absolute;left:0;bottom:0;width:100%;height:8px;background:__RB__;z-index:6}
"""

HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>__STYLE__</style></head><body>
<div class="canvas"><div class="glow"></div>
  <div class="mast">MBA Jargon</div>
  <div class="chip"><span class="dot"></span>__SUBJECT__</div>
  <div class="card">
    <img class="banner" src="file://__IMG__">
    <div class="body">
      <div class="headline">__HEAD__</div>
      <div class="def">__DEF__</div>
      <div class="diag">__DIAG__</div>
      <div class="note">__NOTE__</div>
    </div>
  </div>
  <div class="footzone"><div style="display:flex;flex-direction:column;align-items:center;gap:11px">
    <div class="wm">Re<span>hearsal</span></div><div class="wmline"></div></div>
    <div class="cta">Download the Rehearsal app</div></div>
  <div class="grain"></div><div class="stripe"></div>
</div></body></html>"""


def hs(headline):
    n = len(headline)
    return 78 if n <= 12 else 64 if n <= 20 else 52


def render(c, subject="marketing"):
    sub = SUBJECT[subject]
    style = (STYLE.replace("__RB__", RB).replace("__SUB__", sub)
             .replace("__SUBL__", sub).replace("__SUBBG__", "rgba(255,72,89,0.12)")
             .replace("__GLOW__", "rgba(255,72,89,0.12)").replace("__HS__", str(hs(c["headline"]))))
    dtype, *dargs = c["diag"]
    diag = DIAG[dtype](*dargs)
    html = (HTML.replace("__STYLE__", style).replace("__SUBJECT__", subject.title())
            .replace("__IMG__", str(VISUALS / c["img"])).replace("__HEAD__", esc(c["headline"]))
            .replace("__DEF__", esc(c["def"])).replace("__DIAG__", diag).replace("__NOTE__", c["note"]))
    hdir = HERE / "marketing-sem1" / "_html"; hdir.mkdir(parents=True, exist_ok=True)
    hp = hdir / f"{c['slug']}.html"; pp = HERE / "marketing-sem1" / f"{c['slug']}.png"
    hp.write_text(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                    "--window-size=1080,1350", "--virtual-time-budget=8000",
                    "--run-all-compositor-stages-before-draw", f"--screenshot={pp}", f"file://{hp}"],
                   check=True, capture_output=True)
    print(f"  jargon {c['slug']:26s} -> {pp.name}")


def main(targets):
    cards = [c for c in CARDS if not targets or c["slug"] in targets]
    for c in cards:
        render(c)


if __name__ == "__main__":
    main(sys.argv[1:])
