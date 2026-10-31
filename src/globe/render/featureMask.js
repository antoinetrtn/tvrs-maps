import * as THREE from "three";

import { riversMountainsDataMap } from "../../data/riversMountainsData";
import { getFeatureSeed, walkMountainChain, walkRiverPolyline } from "./globeTopographyStamper";

const FEATURE_MASK_WIDTH = 3600;
const FEATURE_MASK_HEIGHT = 1800;
export const FEATURE_FOUND_VALUE = 40;
export const FEATURE_SELECTED_VALUE = 255;
export const FEATURE_HALO_VALUES = [170, 115, 60];

let maskData = null;
let maskTexture = null;

let lastSelectedKey = undefined;
let lastFoundKeysHash = undefined;
let lastDataMap = undefined;

/**
 * Lazily creates and returns the 3600x1800 R8 DataTexture for feature highlight mask.
 */
export function getFeatureMaskTexture() {
  if (!maskTexture) {
    maskData = new Uint8Array(FEATURE_MASK_WIDTH * FEATURE_MASK_HEIGHT);
    maskTexture = new THREE.DataTexture(
      maskData,
      FEATURE_MASK_WIDTH,
      FEATURE_MASK_HEIGHT,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    maskTexture.magFilter = maskTexture.minFilter = THREE.NearestFilter;
    maskTexture.generateMipmaps = false;
    maskTexture.unpackAlignment = 1;
    maskTexture.needsUpdate = true;
  }
  return maskTexture;
}

/**
 * Direct access to the raw mask buffer (useful for unit testing without WebGL).
 */
export function getFeatureMaskData() {
  getFeatureMaskTexture();
  return maskData;
}

/**
 * Collects pixel indices for a given river or mountain feature on the 3600x1800 grid.
 */
export function getFeatureCells(key, item) {
  if (!item) return [];

  // Same index as stampTopographyChannels so the meander matches the stamped pixels.
  let idx = key ? Object.keys(riversMountainsDataMap).indexOf(key) : 0;
  if (idx < 0) idx = 0;
  const seed = getFeatureSeed(item, idx);

  const cells = [];
  const setCell = (x, y) => {
    if (y < 0 || y >= FEATURE_MASK_HEIGHT) return;
    const wx = ((x % FEATURE_MASK_WIDTH) + FEATURE_MASK_WIDTH) % FEATURE_MASK_WIDTH;
    cells.push(y * FEATURE_MASK_WIDTH + wx);
  };

  if (item.type === "river" && item.path) {
    walkRiverPolyline(item.path, seed, FEATURE_MASK_WIDTH, FEATURE_MASK_HEIGHT, (x, y, cosLat) => {
      setCell(x, y);
      if (cosLat < 0.72) setCell(x + 1, y);
    });
  } else if ((item.type === "mountain_range" || item.type === "mountain") && item.path) {
    walkMountainChain(
      item.path,
      item.spread,
      item.height,
      seed,
      FEATURE_MASK_WIDTH,
      FEATURE_MASK_HEIGHT,
      (x, y, cosLat, bVal) => {
        // Threshold 97 corresponds to step(0.38, mountainRelief) (0.38 * 255 = 96.9)
        if (bVal >= 97) {
          setCell(x, y);
          if (cosLat < 0.72) setCell(x + 1, y);
        }
      }
    );
  }

  // Fallback for single-point or pathless items, or if relief threshold generated no cells
  if (cells.length === 0 && Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
    const y = Math.floor(((item.lat + 90) / 180) * FEATURE_MASK_HEIGHT);
    const x = Math.floor(((item.lng + 180) / 360) * FEATURE_MASK_WIDTH);
    setCell(x, y);
  }

  return cells;
}

/**
 * Rebuilds the feature highlight mask only when inputs change.
 * - Value 40 for FOUND features
 * - Value 255 for SELECTED feature
 * - Halo rings 170, 115, 60 around SELECTED feature via 4-neighbour BFS
 */
export function setFeatureMask({
  selectedKey = null,
  foundKeys = null,
  dataMap = riversMountainsDataMap,
} = {}) {
  const foundArray = Array.isArray(foundKeys)
    ? foundKeys
    : foundKeys instanceof Set
      ? Array.from(foundKeys)
      : [];
  const foundHash = foundArray.slice().sort().join("|");

  if (
    selectedKey === lastSelectedKey &&
    foundHash === lastFoundKeysHash &&
    dataMap === lastDataMap
  ) {
    return;
  }

  lastSelectedKey = selectedKey;
  lastFoundKeysHash = foundHash;
  lastDataMap = dataMap;

  getFeatureMaskTexture();
  maskData.fill(0);

  const activeDataMap = dataMap || riversMountainsDataMap;

  // 1. Write FOUND features (value 40)
  for (let f = 0; f < foundArray.length; f++) {
    const fKey = foundArray[f];
    if (fKey === selectedKey) continue;
    const item = activeDataMap[fKey] || riversMountainsDataMap[fKey];
    if (!item) continue;
    const cells = getFeatureCells(fKey, item);
    for (let c = 0; c < cells.length; c++) {
      maskData[cells[c]] = FEATURE_FOUND_VALUE;
    }
  }

  // 2. Write SELECTED feature: river = amber line + outward halo; massif = outline + inner halo.
  const item = selectedKey && (activeDataMap[selectedKey] || riversMountainsDataMap[selectedKey]);
  if (item) {
    const cells = getFeatureCells(selectedKey, item);
    if (item.type === "mountain_range" || item.type === "mountain") writeAreaOutline(cells);
    else writeLineHalo(cells);
  }

  maskTexture.needsUpdate = true;
}

const isSelectedOrHalo = (v) => v === FEATURE_SELECTED_VALUE || FEATURE_HALO_VALUES.includes(v);

/** 4-neighbours of a mask cell (longitude wraps, latitude clamps). */
function neighbours4(idx) {
  const W = FEATURE_MASK_WIDTH;
  const y = Math.floor(idx / W);
  const x = idx % W;
  const out = [y * W + ((x + W - 1) % W), y * W + ((x + 1) % W)];
  if (y > 0) out.push(idx - W);
  if (y < FEATURE_MASK_HEIGHT - 1) out.push(idx + W);
  return out;
}

/** River: its own cells at 255, then the halo rings walked OUTWARD (4-neighbour BFS). */
function writeLineHalo(cells) {
  let front = [];
  for (const idx of cells) {
    if (maskData[idx] === FEATURE_SELECTED_VALUE) continue;
    maskData[idx] = FEATURE_SELECTED_VALUE;
    front.push(idx);
  }
  for (const haloVal of FEATURE_HALO_VALUES) {
    const next = [];
    for (const idx of front) {
      for (const n of neighbours4(idx)) {
        if (isSelectedOrHalo(maskData[n])) continue;
        maskData[n] = haloVal;
        next.push(n);
      }
    }
    front = next;
  }
}

/**
 * Mountain band: like the country selection, a thin 1-cell amber border (255) on
 * the band's edge and the halo rings walked INWARD, so the relief stays readable.
 */
function writeAreaOutline(cells) {
  const W = FEATURE_MASK_WIDTH;
  // Morphological closing (8-neighbour dilate x2, erode x2): the stamped spurs are
  // ragged, the outline follows the massif's silhouette instead of every speckle.
  const ring8 = (idx) => {
    const y = Math.floor(idx / W);
    const x = idx % W;
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= FEATURE_MASK_HEIGHT) continue;
      for (let dx = -1; dx <= 1; dx++) out.push(ny * W + ((x + dx + W) % W));
    }
    return out;
  };
  let inside = new Set(cells);
  for (let k = 0; k < 2; k++) {
    const grown = new Set(inside);
    for (const idx of inside) for (const n of ring8(idx)) grown.add(n);
    inside = grown;
  }
  for (let k = 0; k < 2; k++) {
    const kept = new Set();
    for (const idx of inside) if (ring8(idx).every((n) => inside.has(n))) kept.add(idx);
    inside = kept;
  }
  for (const c of cells) inside.add(c);
  const nb = (idx) => {
    const y = Math.floor(idx / W);
    const x = idx % W;
    const out = [];
    if (y > 0) out.push(idx - W);
    if (y < FEATURE_MASK_HEIGHT - 1) out.push(idx + W);
    out.push(y * W + ((x + W - 1) % W), y * W + ((x + 1) % W));
    return out;
  };
  const dist = new Map();
  let front = [];
  for (const idx of inside) {
    if (nb(idx).some((n) => !inside.has(n))) {
      dist.set(idx, 0);
      front.push(idx);
      maskData[idx] = FEATURE_SELECTED_VALUE;
    }
  }
  for (let r = 0; r < FEATURE_HALO_VALUES.length; r++) {
    const next = [];
    for (const idx of front)
      for (const n of nb(idx))
        if (inside.has(n) && !dist.has(n)) {
          dist.set(n, r + 1);
          maskData[n] = FEATURE_HALO_VALUES[r];
          next.push(n);
        }
    front = next;
  }
}

/**
 * Clears the mask buffer without any new allocations.
 */
export function clearFeatureMask() {
  if (maskData) {
    maskData.fill(0);
    if (maskTexture) maskTexture.needsUpdate = true;
  }
  lastSelectedKey = undefined;
  lastFoundKeysHash = undefined;
  lastDataMap = undefined;
}
