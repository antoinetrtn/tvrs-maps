import * as THREE from "three";

import { countryDataMap } from "../../data/gameData";
import {
  COMPACT_CAPITALS,
  MAJOR_METROPOLISES,
  MICRO_TERRITORIES,
  SECONDARY_CITIES_BY_COUNTRY,
} from "./capitalLightsData";
import { stampTopographyChannels } from "./globeTopographyStamper";
// 10 texels per degree (0.10° per texel) -> 1 texel ≈ 1px–1.5px on screen at continent zoom
const TEX_WIDTH = 3600;
const TEX_HEIGHT = 1800;

const STEP_DEG = 0.088;

let sharedCapitalLightsTexture = null;

function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function setTexelRG(data, x, y, rVal, gVal) {
  if (y < 0 || y >= TEX_HEIGHT) return;
  const wx = ((x % TEX_WIDTH) + TEX_WIDTH) % TEX_WIDTH;
  const idx = (y * TEX_WIDTH + wx) * 4;
  if (rVal > data[idx]) data[idx] = rVal;
  if (gVal > data[idx + 1]) data[idx + 1] = gVal;
}

function stampIsoPoint(data, lat, lng, cosLat, rVal, gVal) {
  const y = Math.floor(((lat + 90) / 180) * TEX_HEIGHT);
  const x = Math.floor(((lng + 180) / 360) * TEX_WIDTH);
  setTexelRG(data, x, y, rVal, gVal);
  if (cosLat < 0.72) {
    setTexelRG(data, x + 1, y, rVal, gVal);
  }
  if (gVal > 28) {
    const neighborG = Math.round(gVal * 0.58);
    const dx = cosLat < 0.72 ? 2 : 1;
    setTexelRG(data, x - 1, y, 0, neighborG);
    setTexelRG(data, x + dx, y, 0, neighborG);
    setTexelRG(data, x, y - 1, 0, neighborG);
    setTexelRG(data, x, y + 1, 0, neighborG);
  }
}

function stampMetroCoreAndAura(data, lat, lng, seed, cosLat, scaleMode) {
  const y0 = Math.floor(((lat + 90) / 180) * TEX_HEIGHT);
  const x0 = Math.floor(((lng + 180) / 360) * TEX_WIDTH);
  const dxStep = Math.max(1, Math.round(1 / cosLat));
  const auraSteps =
    scaleMode === "secondary" ? 4 : scaleMode === "compact" ? 5 : scaleMode === "major" ? 8 : 6;

  for (let dy = -auraSteps; dy <= auraSteps; dy++) {
    for (let dx = -auraSteps; dx <= auraSteps; dx++) {
      const dist = Math.hypot(dx, dy);
      if (dist > auraSteps) continue;
      const falloff = 1 - dist / auraSteps;
      const gVal = Math.round(Math.pow(falloff, 1.55) * (scaleMode === "secondary" ? 190 : 225));
      let rVal = 0;
      if (dist <= 0.8) {
        rVal = scaleMode === "secondary" ? 236 : 255;
      } else if (dist <= 1.65) {
        const n = hash1(seed + dx * 19.3 + dy * 37.1);
        rVal = n > 0.18 ? Math.round((scaleMode === "secondary" ? 202 : 225) + n * 28) : 180;
      } else if (dist <= 2.6 && scaleMode !== "compact" && scaleMode !== "secondary") {
        const n = hash1(seed + dx * 43.7 + dy * 61.9);
        if (n > 0.52) rVal = Math.round(170 + (n - 0.52) * 90);
      }
      for (let sx = 0; sx < dxStep; sx++) {
        setTexelRG(data, x0 + dx * dxStep + sx, y0 + dy, rVal, gVal);
      }
    }
  }
}

function stampSubBranch(
  data,
  lng,
  cosLat,
  seed,
  t,
  s,
  startLat,
  startLonScaled,
  startAngle,
  remSteps,
  isFirstFork
) {
  const forkSign = hash1(seed + t * 307.1 + s) > 0.5 ? 1 : -1;
  let bAngle = startAngle + forkSign * (0.52 + hash1(seed + t * 349.7 + s) * 0.38);
  const branchSteps = Math.max(
    4,
    Math.round(remSteps * (0.55 + hash1(seed + t * 389.3 + s) * 0.3))
  );
  let bLat = startLat;
  let bLonScaled = startLonScaled;

  for (let bs = 1; bs <= branchSteps; bs++) {
    const bProg = bs / branchSteps;
    bAngle += (hash1(seed + t * 431.1 + s * 13 + bs * 23.9) - 0.5) * 0.28;
    bLat += Math.sin(bAngle) * STEP_DEG;
    bLonScaled += Math.cos(bAngle) * STEP_DEG;
    const bRand = hash1(seed + t * 479.3 + s * 19 + bs * 41.1);
    if (bRand <= 0.78 - bProg * 0.22) {
      const bR = Math.max(76, Math.round((1 - bProg * 0.52) * (isFirstFork ? 172 : 145)));
      const bG = Math.max(24, Math.round((1 - bProg * 0.75) * 95));
      stampIsoPoint(data, bLat, lng + bLonScaled / cosLat, cosLat, bR, bG);
    }
  }
}

function stampPrimaryTentacle(
  data,
  lat,
  lng,
  seed,
  cosLat,
  scaleMode,
  t,
  numTentacles,
  maxStepsBase
) {
  const baseAngle = (t / numTentacles) * Math.PI * 2;
  let angle = baseAngle + (hash1(seed + t * 13.7) - 0.5) * 0.52;
  const totalSteps = Math.round(maxStepsBase * (0.68 + hash1(seed + t * 29.3) * 0.52));
  const curlBias = (hash1(seed + t * 41.9) - 0.5) * 0.095;

  let curLat = lat;
  let curLonScaled = 0;

  for (let s = 1; s <= totalSteps; s++) {
    const progress = s / totalSteps;
    angle += (hash1(seed + t * 101.3 + s * 17.7) - 0.5) * 0.26 + curlBias;
    curLat += Math.sin(angle) * STEP_DEG;
    curLonScaled += Math.cos(angle) * STEP_DEG;
    const curLng = lng + curLonScaled / cosLat;

    const stepRand = hash1(seed + t * 157.1 + s * 31.3);
    const isNodeHub =
      (Math.abs(progress - 0.38) < 0.07 || Math.abs(progress - 0.74) < 0.07) &&
      hash1(seed + t * 193.7 + Math.round(progress * 10)) > 0.25;

    const keepProb = progress < 0.35 ? 0.94 : progress < 0.75 ? 0.8 : 0.64;
    if (isNodeHub || stepRand <= keepProb) {
      const baseIntensity =
        progress < 0.25
          ? 232 - progress * 140
          : progress < 0.65
            ? 198 - (progress - 0.25) * 165
            : 132 - (progress - 0.65) * 130;
      const rVal = Math.max(
        78,
        Math.min(248, Math.round(isNodeHub ? Math.max(baseIntensity + 28, 195) : baseIntensity))
      );
      const gVal = Math.max(30, Math.round((1 - progress * 0.78) * 155));
      stampIsoPoint(data, curLat, curLng, cosLat, rVal, gVal);

      if (isNodeHub) {
        const sideAng = angle + (stepRand > 0.5 ? 1.4 : -1.4);
        stampIsoPoint(
          data,
          curLat + Math.sin(sideAng) * 0.085,
          curLng + (Math.cos(sideAng) * 0.085) / cosLat,
          cosLat,
          Math.max(125, rVal - 32),
          Math.round(gVal * 0.8)
        );
      }
    }

    const shouldFork1 =
      s === Math.max(3, Math.round(totalSteps * 0.36)) && hash1(seed + t * 211.9) > 0.22;
    const shouldFork2 =
      scaleMode !== "compact" &&
      scaleMode !== "secondary" &&
      s === Math.max(6, Math.round(totalSteps * 0.64)) &&
      hash1(seed + t * 263.3) > 0.38;

    if (shouldFork1 || shouldFork2) {
      stampSubBranch(
        data,
        lng,
        cosLat,
        seed,
        t,
        s,
        curLat,
        curLonScaled,
        angle,
        totalSteps - s,
        shouldFork1
      );
    }
  }

  const satCount = scaleMode === "compact" || scaleMode === "secondary" ? 1 : 2;
  for (let k = 0; k < satCount; k++) {
    const satDist = (0.35 + hash1(seed + t * 521.7 + k * 67.3) * 0.58) * totalSteps * STEP_DEG;
    const satAng =
      baseAngle +
      (0.35 + hash1(seed + t * 569.1 + k * 89.7) * 0.35) * ((Math.PI * 2) / numTentacles);
    const sLat = lat + Math.sin(satAng) * satDist;
    const sLng = lng + (Math.cos(satAng) * satDist) / cosLat;
    const sR = Math.round(92 + hash1(seed + t * 613.3 + k * 107.9) * 58);
    stampIsoPoint(data, sLat, sLng, cosLat, sR, 36);
  }
}

function stampCapitalTentacularWeb(data, lat, lng, seed, cosLat, scaleMode) {
  stampMetroCoreAndAura(data, lat, lng, seed, cosLat, scaleMode);

  const numTentacles =
    scaleMode === "secondary" ? 4 : scaleMode === "compact" ? 5 : scaleMode === "major" ? 7 : 6;
  const maxStepsBase =
    scaleMode === "secondary" ? 9 : scaleMode === "compact" ? 11 : scaleMode === "major" ? 23 : 17;

  for (let t = 0; t < numTentacles; t++) {
    stampPrimaryTentacle(data, lat, lng, seed, cosLat, scaleMode, t, numTentacles, maxStepsBase);
  }
}

function stampInterCityCorridor(data, lat1, lng1, lat2, lng2, seed) {
  const cosLat = Math.max(0.22, Math.cos(((lat1 + lat2) * 0.5 * Math.PI) / 180));
  const dLat = lat2 - lat1;
  const dLonScaled = (lng2 - lng1) * cosLat;
  const distDeg = Math.hypot(dLat, dLonScaled);
  if (distDeg < 0.7 || distDeg > 9.5) return;

  const steps = Math.max(8, Math.round(distDeg / 0.14));
  const nx = -dLat / distDeg;
  const ny = dLonScaled / distDeg;
  const arcAmp = Math.min(0.65, distDeg * 0.085) * (hash1(seed + 71.3) > 0.5 ? 1 : -1);

  for (let i = 2; i < steps - 1; i++) {
    const p = i / steps;
    const wave = Math.sin(p * Math.PI) * arcAmp;
    const jitter = (hash1(seed + i * 29.7) - 0.5) * 0.05;
    const curLat = lat1 + dLat * p + nx * (wave + jitter);
    const curLng = lng1 + (dLonScaled * p + ny * (wave + jitter)) / cosLat;

    const rRand = hash1(seed + i * 53.1);
    const isTownBead = i % 4 === 0 || rRand > 0.55;
    if (isTownBead) {
      const endFade = 1 - Math.abs(p - 0.5) * 0.55;
      const rVal = Math.round((i % 4 === 0 ? 155 : 112) * endFade);
      const gVal = Math.round(52 * endFade);
      stampIsoPoint(data, curLat, curLng, cosLat, rVal, gVal);
    }
  }
}

/**
 * Lazily builds a 3600x1800 NearestFilter DataTexture (0.10 deg/texel) of crisp,
 * pixel-art cartographic night lights, topographic mountain relief, and hydrographic rivers:
 * - R channel: crisp 1px dendritic highway tentacles, inter-city corridors, & metropolitan core
 * - G channel: warm nocturnal sodium-amber urban ground aura
 * - B channel: pixel-art mountain ridges, lateral spurs, and stepped contour hachures
 * - A channel: crisp 1px meandering world rivers & hydrographic network
 */
export function getCapitalLightsTexture() {
  if (sharedCapitalLightsTexture) return sharedCapitalLightsTexture;

  const data = new Uint8Array(TEX_WIDTH * TEX_HEIGHT * 4);

  stampTopographyChannels(data, TEX_WIDTH, TEX_HEIGHT);

  Object.entries(countryDataMap).forEach(([admin, info]) => {
    if (MICRO_TERRITORIES.has(admin)) return;
    if (!Number.isFinite(info.lat) || !Number.isFinite(info.lng) || !info.capital) return;
    const lat = info.lat;
    const lng = info.lng;
    const cosLat = Math.max(0.22, Math.cos((lat * Math.PI) / 180));
    const seed = lat * 13.37 + lng * 7.91;
    const scaleMode = COMPACT_CAPITALS.has(admin)
      ? "compact"
      : MAJOR_METROPOLISES.has(admin)
        ? "major"
        : "normal";
    stampCapitalTentacularWeb(data, lat, lng, seed, cosLat, scaleMode);

    const secondaryList = SECONDARY_CITIES_BY_COUNTRY[admin];
    if (secondaryList) {
      secondaryList.forEach(([sLat, sLng], idx) => {
        const sCosLat = Math.max(0.22, Math.cos((sLat * Math.PI) / 180));
        const sSeed = sLat * 17.23 + sLng * 11.41 + idx * 31.7;
        stampCapitalTentacularWeb(data, sLat, sLng, sSeed, sCosLat, "secondary");
        stampInterCityCorridor(data, lat, lng, sLat, sLng, seed + idx * 97.3);
      });
    }
  });

  const tex = new THREE.DataTexture(data, TEX_WIDTH, TEX_HEIGHT, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  sharedCapitalLightsTexture = tex;
  return tex;
}
