import * as THREE from "three";

import { countryDataMap } from "../../data/gameData";

const TEX_WIDTH = 512;
const TEX_HEIGHT = 256;

let sharedCapitalLightsTexture = null;

function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function stampUrbanCluster(data, n, cosLat) {
  const rLng = n.r / cosLat;
  const yMin = Math.max(0, Math.floor(((n.lat - n.r + 90) / 180) * TEX_HEIGHT));
  const yMax = Math.min(TEX_HEIGHT - 1, Math.ceil(((n.lat + n.r + 90) / 180) * TEX_HEIGHT));
  const xCenter = Math.floor(((-n.lng + 180) / 360) * TEX_WIDTH);
  const xSpan = Math.ceil((rLng / 360) * TEX_WIDTH);
  const invR = 1 / n.r;

  for (let y = yMin; y <= yMax; y++) {
    const dLat = ((y + 0.5) / TEX_HEIGHT) * 180 - 90 - n.lat;
    const dLat2 = dLat * dLat;
    for (let dx = -xSpan; dx <= xSpan; dx++) {
      const x = (((xCenter + dx) % TEX_WIDTH) + TEX_WIDTH) % TEX_WIDTH;
      // In Three.js polar2Cartesian: cLng = atan2(z, x) = -lng * DEG -> lng = -cLng / DEG
      const pLng = 180 - ((x + 0.5) / TEX_WIDTH) * 360;
      let dLon = Math.abs(pLng - n.lng);
      if (dLon > 180) dLon = 360 - dLon;
      const dLonScaled = dLon * cosLat;
      const dist = Math.sqrt(dLat2 + dLonScaled * dLonScaled);
      if (dist >= n.r) continue;
      const t = 1 - dist * invR;
      const encoded = Math.min(255, Math.round(t * t * n.w * 255));
      const idx = (y * TEX_WIDTH + x) * 4;
      if (encoded > data[idx]) {
        data[idx] = encoded;
        data[idx + 1] = encoded;
        data[idx + 2] = encoded;
        data[idx + 3] = 255;
      }
    }
  }
}

/**
 * Lazily builds a 512x256 equirectangular DataTexture of urban agglomeration density
 * around each country's capital (plus deterministic satellite metropolitan clusters).
 * Sampled by the country surface shader to render discreet pixel-art night-light zones
 * seen from space.
 */
export function getCapitalLightsTexture() {
  if (sharedCapitalLightsTexture) return sharedCapitalLightsTexture;

  const data = new Uint8Array(TEX_WIDTH * TEX_HEIGHT * 4);

  Object.values(countryDataMap).forEach((info) => {
    if (!Number.isFinite(info.lat) || !Number.isFinite(info.lng) || !info.capital) return;
    const lat = info.lat;
    const lng = info.lng;
    const cosLat = Math.max(0.22, Math.cos((lat * Math.PI) / 180));
    const seed = lat * 13.37 + lng * 7.91;

    // Main capital metropolitan core (~2.3 deg radius) + 4 satellite urban corridors
    stampUrbanCluster(data, { lat, lng, r: 2.75, w: 1.0 }, cosLat);
    for (let s = 0; s < 4; s++) {
      const angle = hash1(seed + s * 11.3) * Math.PI * 2;
      const dist = 0.55 + hash1(seed + s * 23.7) * 1.25;
      stampUrbanCluster(
        data,
        {
          lat: lat + Math.sin(angle) * dist * 0.85,
          lng: lng + (Math.cos(angle) * dist) / cosLat,
          r: 1.35 + hash1(seed + s * 37.1) * 0.75,
          w: 0.62 + hash1(seed + s * 53.9) * 0.32,
        },
        cosLat
      );
    }
  });

  const tex = new THREE.DataTexture(data, TEX_WIDTH, TEX_HEIGHT, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  sharedCapitalLightsTexture = tex;
  return tex;
}
