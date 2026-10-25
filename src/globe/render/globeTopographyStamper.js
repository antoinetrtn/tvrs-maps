import { departmentsDataMap } from "../../data/departmentsData";
import { riversMountainsDataMap } from "../../data/riversMountainsData";
import { usStatesDataMap } from "../../data/usStatesData";

// Flat [lat1, lng1, lat2, lng2, ...] polylines for extra rivers & major tributaries
const EXTRA_RIVERS_FLAT = [
  [54.8, 32.0, 52.4, 30.9, 50.45, 30.52, 48.46, 35.04, 46.63, 32.61], // Dnieper
  [53.5, 39.1, 50.0, 40.5, 48.5, 43.5, 47.23, 39.71], // Don
  [48.0, 5.5, 49.7, 4.9, 50.63, 5.57, 51.9, 4.5], // Meuse
  [47.9, 6.2, 47.1, 4.9, 45.76, 4.83], // Saône
  [48.1, 6.9, 49.12, 6.18, 50.36, 7.6], // Moselle
  [50.1, 11.2, 49.8, 9.93, 50.0, 8.27], // Main
  [38.0, -3.0, 37.88, -4.77, 37.39, -5.99, 36.8, -6.35], // Guadalquivir
  [39.1, -3.8, 38.88, -6.97, 37.18, -7.4], // Guadiana
  [46.9, 10.5, 47.26, 11.39, 48.57, 13.46], // Inn
  [46.3, 14.1, 45.8, 15.98, 44.82, 20.45], // Sava
  [48.1, 24.2, 47.5, 21.6, 46.25, 20.15, 45.14, 20.28], // Tisza
  [34.8, 97.5, 36.06, 103.83, 40.8, 108.5, 34.8, 113.6, 37.75, 119.15], // Yellow River
  [29.3, 88.8, 29.65, 94.3, 27.5, 95.0, 26.18, 91.74, 23.8, 89.8], // Brahmaputra
  [25.4, 97.4, 21.96, 96.08, 16.8, 95.5], // Irrawaddy
  [24.5, 104.5, 23.4, 111.3, 23.13, 113.26, 22.2, 113.6], // Pearl River
  [37.2, 71.5, 39.0, 63.6, 42.5, 59.6], // Amu Darya
  [41.0, 71.6, 44.8, 65.5, 46.0, 61.5], // Syr Darya
  [-0.4, 33.2, 4.85, 31.6, 9.5, 31.8], // White Nile
  [11.6, 37.4, 11.2, 34.9, 15.6, 32.5], // Blue Nile
  [9.3, 13.4, 7.8, 6.7], // Benue
  [-10.5, 22.3, -4.3, 20.6, -3.2, 16.2], // Kasai
  [2.0, -67.1, -1.4, -61.8, -3.1, -60.0], // Rio Negro
  [-10.8, -65.3, -6.5, -62.3, -3.4, -58.8], // Madeira
  [-13.5, -49.1, -5.5, -47.5, -1.45, -48.5], // Tocantins
  [-19.0, -57.6, -25.3, -57.6, -27.3, -58.6], // Paraguay
  [40.44, -80.0, 38.25, -85.76, 37.0, -89.13], // Ohio
  [50.0, -116.0, 47.6, -117.4, 45.6, -121.2, 46.2, -124.0], // Columbia
  [49.9, 3.3, 49.89, 2.3, 50.18, 1.65], // Somme
  [48.1, -0.8, 48.11, -1.68, 47.5, -2.4], // Vilaine
  [45.8, 0.6, 45.65, 0.16, 45.95, -1.05], // Charente
  [45.55, 2.8, 45.18, 1.5, 44.85, 0.48, 45.04, -0.6], // Dordogne
  [44.5, 3.5, 44.45, 1.44, 44.3, 0.33], // Lot
  [44.3, 3.6, 43.93, 2.15, 44.08, 1.1], // Tarn
  [43.0, 0.15, 43.7, -1.05, 43.52, -1.52], // Adour
  [44.6, 3.88, 45.78, 3.18, 46.56, 3.33, 46.95, 3.1], // Allier
  [45.9, 2.45, 46.8, 2.4, 47.39, 0.68], // Cher
  [47.8, 4.5, 48.3, 4.08, 48.95, 2.38], // Yonne / Marne
  [46.7, 6.15, 47.24, 6.02, 47.1, 5.1], // Doubs
  [45.45, 6.95, 45.56, 5.92, 45.19, 5.72, 45.0, 4.88], // Isere
  [44.9, 6.65, 44.4, 6.0, 43.7, 5.5, 43.92, 4.75], // Durance
  [39.25, -106.3, 38.25, -104.6, 37.68, -97.33, 35.38, -94.4, 34.74, -92.28, 33.8, -91.1], // Arkansas
  [43.8, -110.6, 42.8, -112.8, 43.6, -116.5, 46.2, -119.0], // Snake
  [36.0, -83.9, 34.7, -87.7, 37.0, -88.6], // Tennessee
  [44.1, -73.9, 42.65, -73.75, 40.7, -74.0], // Hudson
  [41.3, -122.3, 38.58, -121.5, 38.05, -121.9], // Sacramento
  [34.8, -102.5, 33.9, -98.5, 31.3, -92.4, 31.0, -91.8], // Red River
];

// Flat [spread, height, lat1, lng1, lat2, lng2, ...] for extra mountain chains
const EXTRA_MOUNTAINS_FLAT = [
  [1.8, 2592, 40.3, -6.2, 40.8, -3.9, 41.8, -2.2, 40.4, -1.1], // Sistema Central & Iberico
  [2.0, 2376, 43.8, 22.4, 42.7, 24.9, 42.8, 27.8], // Balkan Mountains
  [1.8, 2637, 41.5, 20.5, 39.8, 21.2, 38.2, 22.0], // Pindus
  [1.8, 1603, 48.8, 13.8, 50.4, 12.9, 50.7, 15.7], // Bohemian / Ore Mountains
  [2.0, 3193, 35.3, 137.6, 36.3, 137.6, 37.5, 139.5, 40.2, 140.8], // Japanese Alps
  [2.0, 3805, 5.0, 96.0, 0.0, 100.5, -5.5, 104.5], // Barisan (Sumatra)
  [2.2, 4884, -4.0, 136.5, -5.0, 141.0, -8.5, 147.0], // New Guinea Central Range
  [2.0, 2876, -14.5, 48.8, -19.0, 47.5, -23.5, 46.5], // Madagascar Highlands
  [2.2, 2891, -25.5, -48.8, -22.9, -44.5, -19.8, -41.5, -13.0, -41.5], // Serra do Mar
  [2.4, 5895, 1.0, 35.5, -1.5, 36.8, -3.07, 37.35, -9.0, 34.0], // East African Rift
];

function flatPairsToPath(flat, startIdx = 0) {
  const out = [];
  for (let i = startIdx; i + 1 < flat.length; i += 2) {
    out.push([flat[i], flat[i + 1]]);
  }
  return out;
}

function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function setTexelB(data, texWidth, texHeight, x, y, bVal) {
  if (y < 0 || y >= texHeight) return;
  const wx = ((x % texWidth) + texWidth) % texWidth;
  const idx = (y * texWidth + wx) * 4;
  if (bVal > data[idx + 2]) data[idx + 2] = bVal;
}

function setTexelA(data, texWidth, texHeight, x, y, aVal) {
  if (y < 0 || y >= texHeight) return;
  const wx = ((x % texWidth) + texWidth) % texWidth;
  const idx = (y * texWidth + wx) * 4;
  if (aVal > data[idx + 3]) data[idx + 3] = aVal;
}

function stampReliefIsoPoint(data, texWidth, texHeight, lat, lng, cosLat, bVal) {
  const y = Math.floor(((lat + 90) / 180) * texHeight);
  const x = Math.floor(((lng + 180) / 360) * texWidth);
  setTexelB(data, texWidth, texHeight, x, y, bVal);
  if (cosLat < 0.72) setTexelB(data, texWidth, texHeight, x + 1, y, bVal);
}

function stampMountainSpur(
  data,
  texWidth,
  texHeight,
  sLat,
  sLng,
  cosLat,
  spineAngle,
  side,
  baseSpurSteps,
  seed,
  stepId
) {
  let spurAng = spineAngle + side * (1.22 + (hash1(seed + stepId * 41.3 + side * 7) - 0.5) * 0.48);
  const spurSteps = Math.max(
    3,
    Math.round(baseSpurSteps * (0.55 + hash1(seed + stepId * 59.1 + side * 13) * 0.65))
  );
  let curLat = sLat;
  let curLonScaled = 0;

  for (let sp = 1; sp <= spurSteps; sp++) {
    const spProg = sp / spurSteps;
    spurAng += (hash1(seed + stepId * 83.7 + sp * 19.3 + side * 5) - 0.5) * 0.34;
    curLat += Math.sin(spurAng) * 0.082;
    curLonScaled += Math.cos(spurAng) * 0.082;
    const curLng = sLng + curLonScaled / cosLat;

    const isContourGap = sp === 3 || (sp > 5 && sp % 3 === 0);
    const val = isContourGap
      ? Math.round(52 * (1 - spProg * 0.4))
      : Math.round((192 - spProg * 115) * (0.88 + hash1(seed + sp * 29.1) * 0.18));
    stampReliefIsoPoint(
      data,
      texWidth,
      texHeight,
      curLat,
      curLng,
      cosLat,
      Math.max(38, Math.min(210, val))
    );
  }
}

function stampMountainStep(
  data,
  texWidth,
  texHeight,
  cLat,
  cLng,
  cosLat,
  spineAngle,
  nx,
  ny,
  elevBoost,
  baseSpurSteps,
  endTaper,
  seed,
  globalStep
) {
  const crestVal = Math.round(
    Math.min(255, (218 + hash1(seed + globalStep * 23.1) * 37) * elevBoost)
  );
  stampReliefIsoPoint(data, texWidth, texHeight, cLat, cLng, cosLat, crestVal);
  const shoulderVal = Math.round(158 * elevBoost);
  stampReliefIsoPoint(
    data,
    texWidth,
    texHeight,
    cLat + nx * 0.085,
    cLng + (ny * 0.085) / cosLat,
    cosLat,
    shoulderVal
  );
  stampReliefIsoPoint(
    data,
    texWidth,
    texHeight,
    cLat - nx * 0.085,
    cLng - (ny * 0.085) / cosLat,
    cosLat,
    58
  );

  if (globalStep % 2 !== 0) return;
  const currentSpurSteps = Math.max(3, Math.round(baseSpurSteps * (0.55 + 0.45 * endTaper)));
  if (hash1(seed + globalStep * 37.9) > 0.22) {
    stampMountainSpur(
      data,
      texWidth,
      texHeight,
      cLat,
      cLng,
      cosLat,
      spineAngle,
      1,
      currentSpurSteps,
      seed,
      globalStep
    );
  }
  if (hash1(seed + globalStep * 53.7) > 0.22) {
    stampMountainSpur(
      data,
      texWidth,
      texHeight,
      cLat,
      cLng,
      cosLat,
      spineAngle,
      -1,
      currentSpurSteps,
      seed,
      globalStep
    );
  }
}

function stampMountainChain(
  data,
  texWidth,
  texHeight,
  path,
  spread = 2.5,
  height = 3000,
  seed = 1
) {
  if (!Array.isArray(path) || path.length < 2) return;
  const elevBoost = Math.min(1.18, Math.max(0.78, height / 3800));
  const baseSpurSteps = Math.min(11, Math.max(4, Math.round((spread || 2.5) * 2.1)));
  let globalStep = 0;

  for (let seg = 0; seg < path.length - 1; seg++) {
    const [lat1, lng1] = path[seg];
    const [lat2, lng2] = path[seg + 1];
    const cosLat = Math.max(0.22, Math.cos(((lat1 + lat2) * 0.5 * Math.PI) / 180));
    const dLat = lat2 - lat1;
    const dLonScaled = (lng2 - lng1) * cosLat;
    const distDeg = Math.hypot(dLat, dLonScaled);
    if (distDeg < 0.05) continue;

    const spineAngle = Math.atan2(dLat, dLonScaled);
    const nx = -Math.sin(spineAngle);
    const ny = Math.cos(spineAngle);
    const steps = Math.max(3, Math.round(distDeg / 0.068));

    for (let i = 0; i <= steps; i++) {
      globalStep++;
      const p = i / steps;
      const chainProg = (seg + p) / (path.length - 1);
      const endTaper = Math.sin(Math.min(1, Math.max(0.08, chainProg)) * Math.PI);
      const meander =
        (Math.sin(globalStep * 0.36 + seed) * 0.12 +
          (hash1(seed + globalStep * 17.3) - 0.5) * 0.07) *
        Math.sin(p * Math.PI);
      const cLat = lat1 + dLat * p + nx * meander;
      const cLng = lng1 + (dLonScaled * p + ny * meander) / cosLat;
      stampMountainStep(
        data,
        texWidth,
        texHeight,
        cLat,
        cLng,
        cosLat,
        spineAngle,
        nx,
        ny,
        elevBoost,
        baseSpurSteps,
        endTaper,
        seed,
        globalStep
      );
    }
  }
}

function stampRiverPolyline(data, texWidth, texHeight, path, seed = 1.0) {
  if (!Array.isArray(path) || path.length < 2) return;
  for (let seg = 0; seg < path.length - 1; seg++) {
    const [lat1, lng1] = path[seg];
    const [lat2, lng2] = path[seg + 1];
    const cosLat = Math.max(0.22, Math.cos(((lat1 + lat2) * 0.5 * Math.PI) / 180));
    const dLat = lat2 - lat1;
    const dLonScaled = (lng2 - lng1) * cosLat;
    const distDeg = Math.hypot(dLat, dLonScaled);
    if (distDeg < 0.04) continue;

    const nx = -dLat / distDeg;
    const ny = dLonScaled / distDeg;
    const steps = Math.max(4, Math.round(distDeg / 0.042));
    const meanderAmp = Math.min(0.16, distDeg * 0.055);

    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const env = Math.sin(p * Math.PI);
      const wave =
        (Math.sin(p * Math.PI * 3.0 + seed + seg * 2.1) * 0.72 +
          Math.sin(p * Math.PI * 7.0 + seed * 1.7 + seg * 4.3) * 0.28) *
        meanderAmp *
        env;
      const curLat = lat1 + dLat * p + nx * wave;
      const curLng = lng1 + (dLonScaled * p + ny * wave) / cosLat;

      const y = Math.floor(((curLat + 90) / 180) * texHeight);
      const x = Math.floor(((curLng + 180) / 360) * texWidth);
      setTexelA(data, texWidth, texHeight, x, y, 242);
      if (cosLat < 0.72) setTexelA(data, texWidth, texHeight, x + 1, y, 228);
      setTexelA(data, texWidth, texHeight, x + 1, y, 98);
      setTexelA(data, texWidth, texHeight, x, y + 1, 98);
    }
  }
}

function stampRegionalPinpoint(data, texWidth, texHeight, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const y = Math.floor(((lat + 90) / 180) * texHeight);
  const x = Math.floor(((lng + 180) / 360) * texWidth);
  if (y < 0 || y >= texHeight) return;
  const wx = ((x % texWidth) + texWidth) % texWidth;
  const idx = (y * texWidth + wx) * 4;
  data[idx + 1] = 255;
}

export function stampTopographyChannels(data, texWidth, texHeight) {
  Object.values(riversMountainsDataMap).forEach((item, idx) => {
    if (!item?.path) return;
    const seed = (item.lat || idx) * 19.31 + (item.lng || idx) * 11.73 + idx * 7.1;
    if (item.type === "mountain_range" || item.type === "mountain") {
      stampMountainChain(data, texWidth, texHeight, item.path, item.spread, item.height, seed);
    } else if (item.type === "river") {
      stampRiverPolyline(data, texWidth, texHeight, item.path, seed);
    }
  });

  EXTRA_MOUNTAINS_FLAT.forEach((flat, idx) => {
    stampMountainChain(
      data,
      texWidth,
      texHeight,
      flatPairsToPath(flat, 2),
      flat[0],
      flat[1],
      401.7 + idx * 29.3
    );
  });

  EXTRA_RIVERS_FLAT.forEach((flat, idx) => {
    stampRiverPolyline(data, texWidth, texHeight, flatPairsToPath(flat, 0), 811.3 + idx * 37.9);
  });

  Object.values(departmentsDataMap).forEach((dept) => {
    stampRegionalPinpoint(data, texWidth, texHeight, dept?.lat, dept?.lng);
  });
  Object.values(usStatesDataMap).forEach((state) => {
    stampRegionalPinpoint(data, texWidth, texHeight, state?.lat, state?.lng);
  });
}
