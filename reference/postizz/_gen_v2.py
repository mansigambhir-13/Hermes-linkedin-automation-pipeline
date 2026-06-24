#!/usr/bin/env python3
"""v2 sector tiles: black bg + Rehearsal rainbow-gradient rounded border + white core icon.
Generates into postizz/v2/ via fal.ai Gemini 3 Pro Image (4:3)."""
import os, re, subprocess, urllib.request, sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "v2"
OUT.mkdir(exist_ok=True)
for line in (HERE.parent / ".env").read_text().splitlines():
    if line.strip().startswith("FAL_KEY="):
        os.environ.setdefault("FAL_KEY", line.split("=", 1)[1].strip().strip('"').strip("'"))

import fal_client
FAL_MODEL = "fal-ai/gemini-3-pro-image-preview"

FRAME = (
    "A premium mobile app tile, 4:3, on a pure solid matte black background (#0a0a0a) that fills the entire "
    "canvas edge to edge. Centered in the frame sits a vertical rounded-rectangle card with generous rounded "
    "corners, OUTLINED by a single thick smooth multi-colour RAINBOW GRADIENT BORDER STROKE that sweeps "
    "continuously through these brand colours in order: lavender #9677f8, indigo #4e44fd, coral #ff4859, "
    "orange #ff5e00, green #00c483. EXACTLY ONE single continuous border stroke outlines the card; do NOT draw a "
    "double border, no second nested frame, no concentric outline, just one clean rainbow ring. "
    "The border glows softly. The inside of the card is the same pure black as "
    "the background, so the card reads as a luminous rainbow outline only. "
    "Perfectly centered inside the card is one bold clean pure-WHITE icon: {icon}. "
    "The icon has crisp flat geometric edges, flat modern editorial style, no photo texture, no 3D bevel, no gradient on the icon itself. "
    "Absolutely NO text, no letters, no numbers, no watermarks anywhere."
)

JOBS = [
    ("01-it-services-saas.png",          "a node-network lattice: white filled circles (nodes) joined by straight white lines into a connected hexagonal mesh graph"),
    ("02-financial-services-banking.png","a classical bank building facade: a triangular pediment roof resting on a row of evenly spaced vertical columns above a base line (a Greek temple front)"),
    ("03-insurance.png",                 "a single heraldic shield silhouette (a protection shield)"),
    ("04-fmcg-consumer-durables.png",    "two stylized cresting ocean waves side by side, a clean horizontal band of rolling waves"),
    ("05-retail-fashion.png",            "a tall elongated safety-pin / clothing-tag loop: a slender vertical rounded U-shaped loop with the pin crossing the top"),
    ("06-consulting-advisory.png",       "a downward-pointing inverted solid triangle balancing its bottom tip on a short horizontal bar, a precise balance / fulcrum"),
    ("07-manufacturing-industrial.png",  "a factory sawtooth roofline: a row of repeating sharp triangular zigzag peaks (sawtooth factory roof)"),
    ("08-automotive.png",                "three bold right-pointing triangular chevrons in a row, indicating forward speed and motion"),
    ("09-logistics-supply-chain.png",    "a winding S-curve route line with three rounded map location-pins marking points along the path"),
    ("10-energy-utilities.png",          "a radiant sun: a solid central disc with straight tapering rays radiating outward all around it"),
    ("11-hospitality.png",               "a colonnade of three connected rounded archways in a row (an arcade of hotel arches)"),
    ("12-miscellaneous-others.png",      "three DIFFERENT solid shapes clustered tidily together: a circle, an equilateral triangle, and a square, representing assorted / miscellaneous / other"),
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
    print(f"--- v2/{fname} ---")
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
