#!/usr/bin/env python3
"""Regenerate ONLY the IT/SaaS node tile (01) with a sparse, decluttered node graph.
Writes candidates to v2/_cand/ so we can pick before overwriting."""
import os, subprocess, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "v2" / "_cand"
OUT.mkdir(parents=True, exist_ok=True)
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

# Sparse, minimal network — declutters the old dense hexagonal mesh.
ICON = ("a simple minimal network graph: SIX large white filled circular nodes arranged in a loose ring "
        "with ONE central white node, joined by only a FEW thin straight white connector lines (just the "
        "spokes from the centre to each outer node). Sparse and clean with lots of empty black space "
        "between nodes. NOT a dense mesh, NOT a lattice, few lines only, minimalist")

for i in range(2):  # two candidates to choose from
    r = fal_client.subscribe(FAL_MODEL, arguments={
        "prompt": FRAME.format(icon=ICON), "aspect_ratio": "4:3", "resolution": "2K",
        "num_images": 1, "output_format": "png",
    })
    imgs = (r or {}).get("images") or []
    url = imgs[0]["url"] if imgs and imgs[0].get("url") else None
    if not url:
        print(f"cand {i}: no url"); continue
    out = OUT / f"01-node-cand{i}.png"
    tmp = out.with_suffix(".dl")
    urllib.request.urlretrieve(url, str(tmp))
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(out)], capture_output=True, timeout=40)
    tmp.unlink(missing_ok=True)
    print(f"cand {i}: saved {out}")
