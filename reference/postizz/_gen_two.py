#!/usr/bin/env python3
"""One-off: 2 sector-style utility icons matching the flat-matte poster set, via fal.ai Gemini 3 Pro Image."""
import os, re, subprocess, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
# load FAL_KEY from .env
for line in (ROOT / ".env").read_text().splitlines():
    if line.strip().startswith("FAL_KEY="):
        os.environ.setdefault("FAL_KEY", line.split("=", 1)[1].strip().strip('"').strip("'"))

import fal_client

FAL_MODEL = "fal-ai/gemini-3-pro-image-preview"

STYLE = (
    "Flat editorial pictogram in Swiss International Style and Kurzgesagt flat-geometric vocabulary. "
    "A SINGLE pure solid black silhouette, centered, large, with crisp hard geometric edges and no internal detail, "
    "sitting on one flat fully-saturated solid {color} background that fills the entire canvas edge to edge. "
    "Completely flat and matte: no gradients on the subject or background, no long drop shadow, no bevel, no 3D, "
    "no outline stroke, no glow, no vignette. Minimalist museum-poster reduction of a single icon. "
    "SUBJECT: {subject}. "
    "Absolutely NO text, no titles, no labels, no letters, no numbers, no watermarks anywhere in the image. "
    "Image fills the entire canvas edge to edge with the {color} background, no white borders, no margins, no padding, no letterboxing."
)

RAINBOW_BORDER_UPLOAD = (
    "A premium mobile app tile, 4:3, on a pure solid matte black background (#0a0a0a) that fills the entire "
    "canvas edge to edge. Centered in the frame sits a vertical rounded-rectangle card with generous rounded "
    "corners, OUTLINED by a single thick smooth multi-colour RAINBOW GRADIENT BORDER STROKE that sweeps "
    "continuously through these brand colours in order: lavender #9677f8, indigo #4e44fd, coral #ff4859, "
    "orange #ff5e00, green #00c483. The border glows softly. The inside of the card is the same pure black as "
    "the background (so the card reads as just the luminous rainbow outline). Perfectly centered inside the card "
    "is one bold clean pure-white upload glyph: a thick upward-pointing arrow rising from a short horizontal "
    "baseline/tray, crisp flat geometric edges. Flat modern editorial style, no photo texture, no 3D bevel. "
    "Absolutely NO text, no letters, no numbers, no watermarks anywhere."
)

JOBS = [
    {
        "file": "13-custom-upload.png",
        "prompt": RAINBOW_BORDER_UPLOAD,
    },
]


def gen(prompt):
    r = fal_client.subscribe(FAL_MODEL, arguments={
        "prompt": prompt, "aspect_ratio": "4:3", "resolution": "2K",
        "num_images": 1, "output_format": "png",
    })
    imgs = (r or {}).get("images") or []
    return imgs[0]["url"] if imgs and imgs[0].get("url") else None


for j in JOBS:
    out = HERE / j["file"]
    prompt = j.get("prompt") or STYLE.format(color=j["color"], subject=j["subject"])
    print(f"--- {j['file']} (fal Gemini, 4:3) ---")
    try:
        url = gen(prompt)
    except Exception as e:
        print(f"  ERROR {str(e)[:300]}"); continue
    if not url:
        print("  no image url"); continue
    tmp = out.with_suffix(".dl")
    urllib.request.urlretrieve(url, str(tmp))
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(out)], capture_output=True, timeout=40)
    tmp.unlink(missing_ok=True)
    dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(out)],
                          capture_output=True, text=True).stdout
    wh = re.findall(r":\s*(\d+)", dims)
    print(f"  saved {out.name}  {'x'.join(wh)}")
