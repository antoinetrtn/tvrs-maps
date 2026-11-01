// Land mask + great-circle sampling for the boats' sea lanes.
// Shared by scripts/build-sea-lanes.mjs and the sea-lane unit test.
import fs from "node:fs";

// Paths are relative to the repo root (npm scripts and vitest run from there).
/**
 * Land mask rasterised from the country polygons the globe actually draws
 * (public/data/countries-50m-low.json), 0.125°/texel, row 0 = 90°S. The baked
 * land-cover PNG (public/textures/world-landcover-1440.png) is dilated around coasts (it marks most of the Red Sea
 * and Tyrrhenian as land), so it is not a faithful coastline.
 */
const COUNTRIES_URL = "public/data/countries-50m-low.json";
export function loadLandMask(file = COUNTRIES_URL, res = 0.125) {
  const w = Math.round(360 / res);
  const h = Math.round(180 / res);
  const land = new Uint8Array(w * h);
  const geo = JSON.parse(fs.readFileSync(file, "utf8"));
  const polys = [];
  geo.features.forEach(({ geometry: g }) => {
    if (!g) return;
    if (g.type === "Polygon") polys.push(g.coordinates);
    else if (g.type === "MultiPolygon") polys.push(...g.coordinates);
  });
  const xs = [];
  polys.forEach((rings) => {
    let minY = 90;
    let maxY = -90;
    rings[0].forEach(([, la]) => {
      minY = Math.min(minY, la);
      maxY = Math.max(maxY, la);
    });
    const y0 = Math.max(0, Math.floor((minY + 90) / res));
    const y1 = Math.min(h - 1, Math.floor((maxY + 90) / res));
    for (let y = y0; y <= y1; y++) {
      const lat = (y + 0.5) * res - 90;
      xs.length = 0;
      rings.forEach((ring) => {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (yi > lat !== yj > lat) xs.push(xi + ((lat - yi) / (yj - yi)) * (xj - xi));
        }
      });
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil((xs[k] + 180) / res - 0.5);
        const xb = Math.floor((xs[k + 1] + 180) / res - 0.5);
        for (let x = xa; x <= xb; x++) land[y * w + (((x % w) + w) % w)] = 1;
      }
    }
  });
  return { w, h, land };
}

export const texelOf = (mask, lat, lng) => {
  const x = Math.floor(((((lng + 180) % 360) + 360) % 360) / (360 / mask.w)) % mask.w;
  const y = Math.min(mask.h - 1, Math.max(0, Math.floor((lat + 90) / (180 / mask.h))));
  return y * mask.w + x;
};
export const isLand = (mask, lat, lng) => mask.land[texelOf(mask, lat, lng)] === 1;

const toUnit = (lat, lng) => {
  const p = (lat * Math.PI) / 180;
  const t = (lng * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(t), Math.cos(p) * Math.sin(t), Math.sin(p)];
};

/** Dense samples (default every 0.02°) of the great-circle leg a→b, as [lat, lng]. */
export function sampleLeg([la1, lo1], [la2, lo2], stepDeg = 0.02) {
  const A = toUnit(la1, lo1);
  const B = toUnit(la2, lo2);
  const om = Math.acos(Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  const k = Math.max(2, Math.ceil((om * 180) / Math.PI / stepDeg));
  const out = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k;
    let v = A;
    if (om > 1e-9) {
      const s1 = Math.sin((1 - t) * om) / Math.sin(om);
      const s2 = Math.sin(t * om) / Math.sin(om);
      v = [s1 * A[0] + s2 * B[0], s1 * A[1] + s2 * B[1], s1 * A[2] + s2 * B[2]];
    }
    const n = Math.hypot(v[0], v[1], v[2]);
    out.push([(Math.asin(v[2] / n) * 180) / Math.PI, (Math.atan2(v[1], v[0]) * 180) / Math.PI]);
  }
  return out;
}
