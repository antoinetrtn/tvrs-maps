#!/usr/bin/env python3
"""
Build public/textures/painted-france-2048.webp: the smooth "painted" high-res France
terrain used by the regional (Départements) mode. Lazy-loaded at runtime.

Source: NASA Blue Marble NG (July 2004, 500 m, public domain) tiles B1 + C1:
  https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74092/world.200407.3x21600x21600.{B1,C1}.jpg
Usage: python3 scripts/build-painted-france.py <B1.jpg> <C1.jpg>
Bounds must match PAINTED_FRANCE_BOUNDS in src/globe/render/paintedTerrain.js.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
LNG_MIN, LNG_MAX, LAT_MIN, LAT_MAX = -5.6, 10.0, 41.0, 51.4
PX = 240  # tile pixels per degree
OUT_W, OUT_H = 2048, 1366


def crop():
    b1, c1 = Image.open(sys.argv[1]), Image.open(sys.argv[2])
    top, bot = round((90 - LAT_MAX) * PX), round((90 - LAT_MIN) * PX)
    left = b1.crop((round((90 + LNG_MIN) * PX), top, 21600, bot))
    right = c1.crop((0, top, round(LNG_MAX * PX), bot))
    out = Image.new("RGB", (left.width + right.width, bot - top))
    out.paste(left, (0, 0))
    out.paste(right, (left.width, 0))
    return out


def grade(img):
    a = np.asarray(img, dtype=np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    water = (b > r * 1.25) & (b > g * 0.95) & (luma < 0.32)
    # Painted: saturate a little, compress highlights, nocturnal cool shadows.
    grey = luma[..., None]
    col = grey + (a - grey) * 1.25
    col = col / (1.0 + col * 0.55)
    shadow = np.clip(1.0 - luma * 2.2, 0.0, 1.0)[..., None]
    col = col * 0.92 + shadow * np.array([0.0, 0.012, 0.035], dtype=np.float32)
    alpha = np.where(water, 0.0, 1.0)
    rgba = np.dstack([np.clip(col, 0, 1), alpha]) * 255.0
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def main():
    src = crop().filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.SMOOTH)
    small = src.resize((OUT_W, OUT_H), Image.LANCZOS)
    out = grade(small)
    mask = out.getchannel("A").filter(ImageFilter.MedianFilter(5))
    out.putalpha(mask)
    out.save("public/textures/painted-france-2048.webp", "WEBP", quality=80, method=6)


if __name__ == "__main__":
    main()
