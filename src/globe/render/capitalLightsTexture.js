import * as THREE from "three";

import { countryDataMap } from "../../data/gameData";

// 10 texels per degree (0.10° per texel) -> 1 texel ≈ 1px–1.5px on screen at continent zoom
const TEX_WIDTH = 3600;
const TEX_HEIGHT = 1800;

// Skip micro-territories and tiny island dependencies so they don't crowd neighboring capitals
const MICRO_TERRITORIES = new Set([
  "Aland",
  "Andorra",
  "Anguilla",
  "Aruba",
  "Bermuda",
  "British Virgin Islands",
  "Cayman Islands",
  "Cook Islands",
  "Curaçao",
  "Dominica",
  "Falkland Islands",
  "Faroe Islands",
  "French Polynesia",
  "Gibraltar",
  "Greenland",
  "Grenada",
  "Guam",
  "Guernsey",
  "Isle of Man",
  "Jersey",
  "Kiribati",
  "Liechtenstein",
  "Macao",
  "Maldives",
  "Malta",
  "Marshall Islands",
  "Federated States of Micronesia",
  "Monaco",
  "Montserrat",
  "Nauru",
  "New Caledonia",
  "Niue",
  "Norfolk Island",
  "Northern Mariana Islands",
  "Palau",
  "Pitcairn Islands",
  "Saint Barthelemy",
  "Saint Helena",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Martin",
  "Saint Pierre and Miquelon",
  "Saint Vincent and the Grenadines",
  "American Samoa",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Seychelles",
  "Sint Maarten",
  "Solomon Islands",
  "Tonga",
  "Turks and Caicos Islands",
  "Tuvalu",
  "United States Virgin Islands",
  "Vanuatu",
  "Vatican",
  "Wallis and Futuna",
]);

// Compact capitals in tightly packed regions get a slightly tighter reach so neighbors stay distinct
const COMPACT_CAPITALS = new Set([
  "Albania",
  "Armenia",
  "Bosnia and Herzegovina",
  "Brunei",
  "Burundi",
  "Cyprus",
  "Djibouti",
  "Equatorial Guinea",
  "Estonia",
  "Gambia",
  "Georgia",
  "Kosovo",
  "Kuwait",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Lithuania",
  "Luxembourg",
  "Moldova",
  "Montenegro",
  "North Macedonia",
  "Palestine",
  "Qatar",
  "Rwanda",
  "Slovakia",
  "Slovenia",
  "Swaziland",
  "Switzerland",
  "Timor-Leste",
  "Trinidad and Tobago",
]);

let sharedCapitalLightsTexture = null;

function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function setTexelMax(data, x, y, val) {
  if (y < 0 || y >= TEX_HEIGHT) return;
  const wx = ((x % TEX_WIDTH) + TEX_WIDTH) % TEX_WIDTH;
  const idx = (y * TEX_WIDTH + wx) * 4;
  if (val > data[idx]) {
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }
}

function stampDot(data, lat, lng, dLatDeg, dLonScaledDeg, cosLat, val) {
  const pLat = lat + dLatDeg;
  const pLng = lng + dLonScaledDeg / cosLat;
  const y = Math.floor(((pLat + 90) / 180) * TEX_HEIGHT);
  const x = Math.floor(((pLng + 180) / 360) * TEX_WIDTH);
  setTexelMax(data, x, y, val);
  if (cosLat < 0.72) {
    setTexelMax(data, x + 1, y, val);
  }
}

function stampCapitalStarCluster(data, lat, lng, seed, cosLat, isCompact) {
  const y0 = Math.floor(((lat + 90) / 180) * TEX_HEIGHT);
  const x0 = Math.floor(((lng + 180) / 360) * TEX_WIDTH);

  // 1. Crisp pinpoint core right on the exact capital GPS coordinate (100% intensity = 255)
  setTexelMax(data, x0, y0, 255);
  // Tight 1-texel cross/cluster heart around the exact center (~8-10 km)
  const dxStep = Math.max(1, Math.round(1 / cosLat));
  setTexelMax(data, x0 + dxStep, y0, 245);
  setTexelMax(data, x0, y0 + 1, 245);
  if (!isCompact) {
    setTexelMax(data, x0 - dxStep, y0, 235);
    setTexelMax(data, x0, y0 - 1, 235);
  }

  // 2. Delicate, discrete 1px starry filaments & isolated satellite pinpricks radiating outward
  // Notice we place discrete dots at stepped distances so dark land remains visible between sparks!
  const numRays = isCompact ? 4 : 6;
  for (let r = 0; r < numRays; r++) {
    const baseAngle = (r / numRays) * Math.PI * 2;
    const angle = baseAngle + (hash1(seed + r * 13.7) - 0.5) * 0.45;
    const curve = (hash1(seed + r * 29.3) - 0.5) * 0.35;

    // Inner highway spark (~0.18°–0.24° from center)
    const d1 = (isCompact ? 0.15 : 0.18) + hash1(seed + r * 41.1) * 0.06;
    const a1 = angle + curve * 0.4;
    stampDot(data, lat, lng, Math.sin(a1) * d1, Math.cos(a1) * d1, cosLat, 205);

    // Mid suburban satellite spark (~0.30°–0.38° from center, separated by dark gap)
    if (hash1(seed + r * 59.3) > 0.15) {
      const d2 = (isCompact ? 0.25 : 0.31) + hash1(seed + r * 71.9) * 0.07;
      const a2 = angle + curve * 0.8;
      stampDot(data, lat, lng, Math.sin(a2) * d2, Math.cos(a2) * d2, cosLat, 170);
    }

    // Outer isolated 1px pinprick (~0.44°–0.56° from center, only on main corridors)
    if (!isCompact && hash1(seed + r * 83.7) > 0.35) {
      const d3 = 0.43 + hash1(seed + r * 97.1) * 0.12;
      const a3 = angle + curve * 1.15;
      stampDot(data, lat, lng, Math.sin(a3) * d3, Math.cos(a3) * d3, cosLat, 140);
    }
  }
}

/**
 * Lazily builds a 3600x1800 NearestFilter DataTexture (0.10 deg/texel) of crisp,
 * starry pixel-art capital night lights (bright pinpoint core + discrete 1px satellite sparks).
 */
export function getCapitalLightsTexture() {
  if (sharedCapitalLightsTexture) return sharedCapitalLightsTexture;

  const data = new Uint8Array(TEX_WIDTH * TEX_HEIGHT * 4);

  Object.entries(countryDataMap).forEach(([admin, info]) => {
    if (MICRO_TERRITORIES.has(admin)) return;
    if (!Number.isFinite(info.lat) || !Number.isFinite(info.lng) || !info.capital) return;
    const lat = info.lat;
    const lng = info.lng;
    const cosLat = Math.max(0.22, Math.cos((lat * Math.PI) / 180));
    const seed = lat * 13.37 + lng * 7.91;
    stampCapitalStarCluster(data, lat, lng, seed, cosLat, COMPACT_CAPITALS.has(admin));
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
