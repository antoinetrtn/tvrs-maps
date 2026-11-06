#!/usr/bin/env python3
"""
build-dev-icons.py
Generate tinted DEV PNG copies for icon-192, icon-512, maskable, apple-touch.
Tints the foreground silhouette toward a muted teal accent (#2dd4bf / RGB 45, 212, 191)
while preserving the nocturnal background (#0e1116 / RGB 14, 17, 22).
"""

import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"

ICON_TARGETS = [
    ("icon-192.png", "icon-192-dev.png"),
    ("icon-512.png", "icon-512-dev.png"),
    ("icon-maskable-192.png", "icon-maskable-192-dev.png"),
    ("icon-maskable-512.png", "icon-maskable-512-dev.png"),
    ("apple-touch-icon.png", "apple-touch-icon-dev.png"),
]

BG_COLOR = (14.0, 17.0, 22.0)
TEAL_ACCENT = (45.0, 212.0, 191.0)
BG_LUMA = (BG_COLOR[0] + BG_COLOR[1] + BG_COLOR[2]) / 3.0
RANGE_LUMA = 255.0 - BG_LUMA

def tint_pixel(r, g, b):
    luma = (r + g + b) / 3.0
    factor = max(0.0, min(1.0, (luma - BG_LUMA) / RANGE_LUMA))
    nr = int(round(BG_COLOR[0] + (TEAL_ACCENT[0] - BG_COLOR[0]) * factor))
    ng = int(round(BG_COLOR[1] + (TEAL_ACCENT[1] - BG_COLOR[1]) * factor))
    nb = int(round(BG_COLOR[2] + (TEAL_ACCENT[2] - BG_COLOR[2]) * factor))
    return (nr, ng, nb)

def build_dev_icon(src_name, dst_name):
    src_path = PUBLIC_DIR / src_name
    dst_path = PUBLIC_DIR / dst_name

    if not src_path.exists():
        print(f"Skipping {src_name}: source file not found")
        return

    img = Image.open(src_path)
    has_alpha = img.mode == "RGBA"
    img_rgb = img.convert("RGBA" if has_alpha else "RGB")

    pixels = list(img_rgb.getdata())
    if has_alpha:
        tinted = [
            (*tint_pixel(p[0], p[1], p[2]), p[3])
            for p in pixels
        ]
    else:
        tinted = [
            tint_pixel(p[0], p[1], p[2])
            for p in pixels
        ]

    out_img = Image.new(img.mode, img.size)
    out_img.putdata(tinted)
    out_img.save(dst_path, "PNG", optimize=True)
    print(f"Generated {dst_name} from {src_name} ({img.size[0]}x{img.size[1]})")

def main():
    for src, dst in ICON_TARGETS:
        build_dev_icon(src, dst)

if __name__ == "__main__":
    main()
