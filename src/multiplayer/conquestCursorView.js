/**
 * « Curseurs spatiaux » — pure view maths (no THREE, no DOM): horizon test,
 * screen-edge hints, label side and country-highlight slots. Unit-tested.
 */

/** Extra cos margin so a cursor does not flicker right on the limb. */
const HORIZON_MARGIN = 0.012;

/**
 * Is a point of the globe surface hidden behind the horizon?
 * `dir` unit vector of the point, `cam` camera position (globe radius `radius`).
 * A surface point is visible when dot(dir, camDir) > radius / |cam|.
 */
export function isBeyondHorizon(dir, cam, radius = 100, margin = HORIZON_MARGIN) {
  const dist = Math.hypot(cam[0], cam[1], cam[2]) || 1;
  const dot = (dir[0] * cam[0] + dir[1] * cam[1] + dir[2] * cam[2]) / dist;
  return dot < radius / dist + margin;
}

/** Compass direction (0..7, 0 = right, counter-clockwise, y up) of a 2D vector. */
export function snapDir8(x, y) {
  const a = Math.atan2(y, x);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

/**
 * Where an off-screen cursor's hint sits: the ray from the viewport centre in
 * direction (dx, dy) (screen space, y DOWN) clipped to the viewport inset by
 * `inset`. Returns CSS px relative to the viewport + the compass slot (y up).
 */
export function edgeHintPlacement(dx, dy, rect, inset = {}) {
  const l = inset.left ?? 10;
  const r = inset.right ?? 10;
  const t = inset.top ?? 10;
  const b = inset.bottom ?? 10;
  // The hint lives on the border of the inset box, the ray starts at its centre.
  const halfW = Math.max(1, (rect.width - l - r) / 2);
  const halfH = Math.max(1, (rect.height - t - b) / 2);
  const cx = l + halfW;
  const cy = t + halfH;
  let ux = dx;
  let uy = dy;
  const len = Math.hypot(ux, uy);
  if (len < 1e-6) {
    // Straight behind the globe: no direction to give, park the hint at the bottom.
    ux = 0;
    uy = 1;
  } else {
    ux /= len;
    uy /= len;
  }
  const sx = Math.abs(ux) > 1e-6 ? halfW / Math.abs(ux) : Infinity;
  const sy = Math.abs(uy) > 1e-6 ? halfH / Math.abs(uy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + ux * s, y: cy + uy * s, dir: snapDir8(ux, -uy) };
}

const DEFAULT_LABEL_PLACEMENT = Object.freeze({ left: false, below: false });

/**
 * Label placement for a cursor at screen position (x, y) in a viewport:
 * right of the block by default, flips left near the right edge and drops
 * below near the top edge. `prev` adds hysteresis so it never flickers.
 */
export function labelPlacement(x, y, labelW, rect, prev = DEFAULT_LABEL_PLACEMENT) {
  const M = 8; // keep this far from the edge
  const need = labelW + 14;
  const hyst = 28;
  const left = prev.left ? x + need + M > rect.width - hyst : x + need + M > rect.width;
  const below = prev.below ? y < 40 + hyst : y < 40;
  return { left, below };
}

/**
 * Slots of a country's highlights: the local player's own selection (drawn by
 * the globe itself) is slot 0 when it targets the same country; every remote
 * highlight on that country then takes the next slot (inset outline + the
 * complementary dither phase). Order is stable (by user id).
 * Returns Map(userId → { slot, count }) where count = highlights on the country.
 */
export function assignHighlightSlots(entries, selfCountry = null) {
  const byCountry = new Map();
  for (const e of entries) {
    if (!e.country) continue;
    if (!byCountry.has(e.country)) byCountry.set(e.country, []);
    byCountry.get(e.country).push(e.userId);
  }
  const out = new Map();
  for (const [country, ids] of byCountry) {
    ids.sort();
    const base = selfCountry && selfCountry === country ? 1 : 0;
    const count = ids.length + base;
    ids.forEach((id, i) => out.set(id, { slot: base + i, count }));
  }
  return out;
}
