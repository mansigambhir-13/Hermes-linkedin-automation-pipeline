"""Print-quality exports for the v1 posters.

Two outputs per poster, both built from the same _html/ files that _build.py
writes (run _build.py first if HTML is stale):

  _print/{slug}.pdf      VECTOR PDF via Chrome print-to-pdf. Text, gradients,
                         rainbow rules and store logos stay vector = razor sharp
                         at ANY print size. Embedded artwork (course image, QRs)
                         is raster at source resolution. This is the file to
                         hand to the print shop (CorelDRAW opens PDF natively).

  _print/{slug}@4x.png   4x raster render (4320x7680) via device-scale-factor.
                         ~360 DPI at 12x21in, ~130 DPI at 33x59in standee
                         (large-format standard is 100-150 DPI). Convert to
                         TIFF with: sips -s format tiff {f}.png --out {f}.tiff

Usage:  python3 _export_print.py            # all posters, both formats
        python3 _export_print.py counts     # one poster
        python3 _export_print.py --pdf-only / --png-only [slugs]
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
HTML_DIR = HERE / "_html"
OUT = HERE / "_print"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 1080x1920 px at 96dpi = 11.25in x 20in page (scales losslessly — vector)
PAGE_CSS = "<style>@page{size:1080px 1920px;margin:0} html,body{margin:0}</style>"

SLUGS = ["counts", "said-it", "scribbles", "second-brain", "sharp-tomorrow",
         "sharper", "smarter", "talk-back", "working", "you-know"]


def export_pdf(slug):
    src = HTML_DIR / f"{slug}.html"
    html = src.read_text()
    if "@page" not in html:
        html = html.replace("<head>", "<head>" + PAGE_CSS, 1)
    tmp = HTML_DIR / f"{slug}-print.html"
    tmp.write_text(html)
    pdf = OUT / f"{slug}.pdf"
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer", "--virtual-time-budget=9000",
        f"--print-to-pdf={pdf}", f"file://{tmp}",
    ], check=True, capture_output=True)
    tmp.unlink()
    print(f"  PDF  {pdf.name:24s} {pdf.stat().st_size//1024} KB")


def export_png4x(slug):
    src = HTML_DIR / f"{slug}.html"
    png = OUT / f"{slug}@4x.png"
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        "--window-size=1080,1920", "--force-device-scale-factor=4",
        "--virtual-time-budget=12000", "--run-all-compositor-stages-before-draw",
        f"--screenshot={png}", f"file://{src}",
    ], check=True, capture_output=True)
    print(f"  PNG  {png.name:24s} {png.stat().st_size//1048576} MB (4320x7680)")


def main(argv):
    pdf = "--png-only" not in argv
    png = "--pdf-only" not in argv
    targets = [a for a in argv if not a.startswith("--")] or SLUGS
    OUT.mkdir(exist_ok=True)
    for slug in targets:
        if not (HTML_DIR / f"{slug}.html").exists():
            print(f"  ! no HTML for {slug} — run _build.py first", file=sys.stderr); continue
        if pdf: export_pdf(slug)
        if png: export_png4x(slug)
    print(f"\n  exports in {OUT}/")


if __name__ == "__main__":
    main(sys.argv[1:])
