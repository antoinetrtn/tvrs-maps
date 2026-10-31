#!/usr/bin/env python3
"""
Build public/textures/world-landcover-1440.png + src/globe/render/worldPaletteData.js
from NASA Blue Marble (Visible Earth, public domain) — see docs/world-palette.md.

Usage: python3 scripts/build-world-landcover.py <blue-marble-equirect.jpg>
The source is box-downsampled to 1440x720 (0.25°/texel, row 0 = 90°N); each land
texel is classified from its real colour + latitude, and stored as one 8-bit grey:
  value = classId * 16 + lumaLevel (0..15, real brightness inside its class)
The palette (shadow/base/light per class) is sampled from the same pixels
(15th/50th/85th luminance percentiles), then lightly stylised (sat/brightness).
"""
import colorsys
import json
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
W, H = 1440, 720

CLASSES = [
    "none", "water", "shallow", "ice", "tundra", "taiga", "temperate", "meadow",
    "tropical", "savanna", "steppe", "sand", "rock", "alpine", "wetland",
]
CID = {n: i for i, n in enumerate(CLASSES)}


def classify(r, g, b, lat):
    L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx - mn) / mx if mx else 0
    alat = abs(lat)
    if b > r * 1.6 and b > g and L < 0.3:
        return "shallow" if g > r * 2.2 and g > 30 else "water"
    if L > 0.62 and r > b + 12 and alat < 50:
        return "sand"
    if lat < -62 or mn > 205:
        return "ice"
    if L > 0.62 and r >= b:
        return "sand"
    green = g > r * 1.02
    if green:
        if L < 0.25:
            if alat <= 23.5:
                return "tropical"
            return "taiga" if alat >= 50 else "temperate"
        if alat >= 60:
            return "tundra"
        if alat <= 30:
            return "savanna"
        return "meadow"
    if sat < 0.25 and 0.35 < L <= 0.62:
        return "alpine"
    if L > 0.5 or (g < r * 0.75 and alat < 40):
        return "rock"
    if alat >= 58:
        return "tundra"
    if alat <= 23.5:
        return "savanna"
    return "steppe"


def main(src):
    im = Image.open(src).convert("RGB").resize((W, H), Image.BOX)
    px = im.load()
    cls = [[0] * W for _ in range(H)]
    lum = [[0.0] * W for _ in range(H)]
    for y in range(H):
        lat = 90 - (y + 0.5) * 180 / H
        for x in range(W):
            r, g, b = px[x, y]
            cls[y][x] = CID[classify(r, g, b, lat)]
            lum[y][x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    # Ocean-connected water is the sea: never drawn (the ocean shader owns it). Flood
    # fill it from the Pacific, then let land classes bleed 3 texels into it so the
    # country polygons' coastal edge never samples sea. Enclosed water = real lakes.
    water_ids = {CID["water"], CID["shallow"]}
    sea = [[False] * W for _ in range(H)]
    # Pacific + marginal seas closed off at 0.25° (Med, Black, Red, Baltic, Gulf,
    # Hudson, Caspian): all owned by the ocean shader, never drawn as lakes.
    seeds = [(0, -140), (35, 18), (43, 34), (20, 38), (58, 20), (27, 51), (60, -85), (42, 51)]
    stack = [(int((lng + 180) / 360 * W), int((90 - lat) / 180 * H)) for lat, lng in seeds]
    while stack:
        x, y = stack.pop()
        if y < 0 or y >= H:
            continue
        x %= W
        if sea[y][x] or cls[y][x] not in water_ids:
            continue
        sea[y][x] = True
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for y in range(H):
        for x in range(W):
            if sea[y][x]:
                cls[y][x] = 0
    bled = set()
    for _ in range(3):
        grow = []
        for y in range(H):
            for x in range(W):
                if cls[y][x] != 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy = y + dy
                    if 0 <= yy < H and cls[yy][(x + dx) % W] not in (0, *water_ids):
                        grow.append((x, y, cls[yy][(x + dx) % W], lum[yy][(x + dx) % W]))
                        break
        for x, y, c, l in grow:
            cls[y][x] = c
            lum[y][x] = l
            bled.add((x, y))
    # Wetlands: vegetated lowland texels touching inland water (real hydrography in BM).
    veg = {CID[n] for n in ("tropical", "temperate", "meadow", "savanna", "taiga", "tundra")}
    water = {CID["water"], CID["shallow"]}
    wet = []
    for y in range(1, H - 1):
        for x in range(W):
            if cls[y][x] not in veg or lum[y][x] > 0.3:
                continue
            n = [cls[y + dy][(x + dx) % W] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            water_n = sum(c in water for c in n)
            if water_n == 1 or water_n == 2:
                wet.append((x, y))
    for x, y in wet:
        cls[y][x] = CID["wetland"]
    # Per-class luminance ranks -> 16 real brightness levels; palette from percentiles.
    samples = {i: [] for i in range(len(CLASSES))}
    for y in range(H):
        for x in range(W):
            if (x, y) not in bled:
                samples[cls[y][x]].append((lum[y][x], px[x, y]))
    palette, ranges = {}, {}
    for cid, s in samples.items():
        if cid == 0 or not s:
            continue
        s.sort(key=lambda t: t[0])
        pick = lambda q: s[min(len(s) - 1, int(q * len(s)))]
        lo, hi = pick(0.05)[0], pick(0.95)[0]
        ranges[cid] = (lo, max(hi, lo + 1e-3))
        tones = []
        for q in (0.15, 0.5, 0.85):
            # average a small window around the percentile for stability
            i = int(q * len(s))
            win = s[max(0, i - 40): i + 40]
            tones.append(tuple(sum(c[1][k] for c in win) / len(win) for k in range(3)))
        palette[CLASSES[cid]] = {"sampled": ["#%02x%02x%02x" % tuple(round(v) for v in t) for t in tones],
                                 "count": len(s)}
    out = Image.new("L", (W, H))
    op = out.load()
    for y in range(H):
        for x in range(W):
            c = cls[y][x]
            if c == 0:
                continue
            lo, hi = ranges[c]
            lvl = max(0, min(15, int((lum[y][x] - lo) / (hi - lo) * 16)))
            op[x, H - 1 - y] = c * 16 + lvl  # flip: texture row 0 = 90°S (flipY false)
    out.save("public/textures/world-landcover-1440.png", optimize=True)
    json.dump(palette, open("/tmp/world-palette-sampled.json", "w"), indent=1)
    print(json.dumps(palette, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
