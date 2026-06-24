#!/usr/bin/env python3
"""v3 sector tiles: same rainbow-border app-tile system as v2, but the inner card is
FORCED to a strict PORTRAIT (tall, ~3:4) rounded-rectangle on every tile — matching the
good 05-retail-fashion look, never the square/landscape 02-banking look.
Generates into postizz/v3/ via fal.ai Gemini 3 Pro Image (4:3 canvas).
Usage: python3 _gen_v3.py [substring]   # optional filter, e.g. "02" to regen one tile."""
import os, re, subprocess, urllib.request, sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "v3"
OUT.mkdir(exist_ok=True)
for line in (HERE.parent / ".env").read_text().splitlines():
    if line.strip().startswith("FAL_KEY="):
        os.environ.setdefault("FAL_KEY", line.split("=", 1)[1].strip().strip('"').strip("'"))

import fal_client
FAL_MODEL = "fal-ai/gemini-3-pro-image-preview"

FRAME = (
    "A premium mobile app tile on a 4:3 landscape canvas of pure solid matte black (#0a0a0a) that fills the "
    "entire canvas edge to edge. "
    "Centered in the frame sits ONE rounded-rectangle card that is STRICTLY PORTRAIT — clearly and obviously "
    "TALLER than it is WIDE, a tall narrow upright card with an aspect ratio of about 3:4 (roughly 3 units wide "
    "by 4 units tall), like a playing card or a smartphone screen standing upright. This tall portrait proportion "
    "is MANDATORY and must look identical on every tile no matter what icon is inside — never a square card, "
    "never a wide/landscape card. The card has generous rounded corners and is OUTLINED by a single thick smooth "
    "multi-colour RAINBOW GRADIENT BORDER STROKE that sweeps continuously through these brand colours in order: "
    "lavender #9677f8, indigo #4e44fd, coral #ff4859, orange #ff5e00, green #00c483. EXACTLY ONE single continuous "
    "border stroke outlines the card; do NOT draw a double border, no second nested frame, no concentric outline, "
    "just one clean rainbow ring. The border glows softly. The inside of the card is the same pure black as the "
    "background, so the card reads as a luminous rainbow outline only. "
    "Centered inside the tall card is one bold clean pure-WHITE icon: {icon}. The icon is scaled to sit "
    "comfortably WITHIN the narrow portrait card with generous empty black space ABOVE and BELOW it; the icon must "
    "NOT stretch or widen the card — keep the card tall and narrow even when the icon is a wide shape (scale a "
    "wide icon smaller so it fits the card's width with breathing room). "
    "The icon has crisp flat geometric edges, flat modern editorial style, no photo texture, no 3D bevel, no "
    "gradient on the icon itself. Absolutely NO text, no letters, no numbers, no watermarks anywhere."
)

JOBS = [
    ("01-it-services-saas.png",          "a simple minimal network graph: six white filled circular nodes in a loose ring around one central white node, joined by only a few thin straight white spoke lines, sparse and clean with empty black space, not a dense mesh"),
    ("02-financial-services-banking.png","a classical bank building facade: a triangular pediment roof resting on a row of evenly spaced vertical columns above a base line (a Greek temple front)"),
    ("03-insurance.png",                 "a single heraldic shield silhouette (a protection shield)"),
    ("04-fmcg-consumer-durables.png",    "two stylized cresting ocean waves stacked, a clean compact band of rolling waves"),
    ("05-retail-fashion.png",            "a tall elongated safety-pin / clothing-tag loop: a slender vertical rounded U-shaped loop with the pin crossing the top"),
    ("06-consulting-advisory.png",       "a downward-pointing inverted solid triangle balancing its bottom tip on a short horizontal bar, a precise balance / fulcrum"),
    ("07-manufacturing-industrial.png",  "a factory sawtooth roofline: a compact row of repeating sharp triangular zigzag peaks (sawtooth factory roof)"),
    ("08-automotive.png",                "three bold right-pointing triangular chevrons stacked, indicating forward speed and motion"),
    ("09-logistics-supply-chain.png",    "a winding vertical S-curve route line with three rounded map location-pins marking points along the path"),
    ("10-energy-utilities.png",          "a radiant sun: a solid central disc with straight tapering rays radiating outward all around it"),
    ("11-hospitality.png",               "a stack of two or three connected rounded archways (an arcade of hotel arches)"),
    ("12-miscellaneous-others.png",      "three different solid shapes clustered tidily together: a circle, an equilateral triangle, and a square, representing assorted / miscellaneous / other"),
    ("13-custom-upload.png",             "an upload glyph: a thick upward-pointing arrow rising from a short horizontal baseline / tray"),
]


def gen(prompt):
    r = fal_client.subscribe(FAL_MODEL, arguments={
        "prompt": prompt, "aspect_ratio": "4:3", "resolution": "2K",
        "num_images": 1, "output_format": "png",
    })
    imgs = (r or {}).get("images") or []
    return imgs[0]["url"] if imgs and imgs[0].get("url") else None


only = sys.argv[1] if len(sys.argv) > 1 else None
for fname, icon in JOBS:
    if only and only not in fname:
        continue
    out = OUT / fname
    print(f"--- v3/{fname} ---")
    try:
        url = gen(FRAME.format(icon=icon))
    except Exception as e:
        print(f"  ERROR {str(e)[:300]}"); continue
    if not url:
        print("  no image url"); continue
    tmp = out.with_suffix(".dl")
    urllib.request.urlretrieve(url, str(tmp))
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(out)], capture_output=True, timeout=40)
    tmp.unlink(missing_ok=True)
    dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(out)], capture_output=True, text=True).stdout
    wh = "x".join(re.findall(r":\s*(\d+)", dims))
    print(f"  saved  {wh}")
