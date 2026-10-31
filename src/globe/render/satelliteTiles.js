import * as THREE from "three";

export const SATELLITE_TILE_MAX_LEVEL = 8;
export const SATELLITE_TILE_RADIUS = 100.02;
const SATELLITE_TILE_MIN_LEVEL = 3;
const MAX_MERCATOR_LAT = 85.0511;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TILE_SEGMENTS = 16;
const MAX_VISIBLE_TILES = 64;
const HORIZON_MARGIN_RAD = 0.08;

export const SATELLITE_TILE_URL = (z, x, y) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;

function latToMercatorY(lat, z) {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const rad = clamped * DEG_TO_RAD;
  const yNorm = 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
  return yNorm * 2 ** z;
}

function mercatorYToLat(y, z) {
  const yNorm = y / 2 ** z;
  const rad = 2 * Math.atan(Math.exp(Math.PI * (1 - 2 * yNorm))) - Math.PI / 2;
  return rad * RAD_TO_DEG;
}

function lonToTileX(lon, z) {
  const xNorm = (lon + 180) / 360;
  return xNorm * 2 ** z;
}

function tileXToLon(x, z) {
  const xNorm = x / 2 ** z;
  return xNorm * 360 - 180;
}

export function tileLevelForAltitude(altitude) {
  if (!Number.isFinite(altitude) || altitude >= 1.2) {
    return 0;
  }
  const safeAlt = Math.max(0.0001, altitude);
  const raw = Math.floor(4.0 - Math.log2(safeAlt));
  return Math.max(SATELLITE_TILE_MIN_LEVEL, Math.min(SATELLITE_TILE_MAX_LEVEL, raw));
}

function haversineDist(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dPhi = phi2 - phi1;
  const dLam = (lon2 - lon1) * DEG_TO_RAD;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function computeLongitudeSpan(capRadius, clampedLatRad) {
  const sinCap = Math.sin(capRadius);
  const cosLat = Math.cos(clampedLatRad);
  if (sinCap >= cosLat) {
    return 180;
  }
  return Math.asin(sinCap / cosLat) * RAD_TO_DEG;
}

export function visibleTiles(pov, level) {
  if (!level || level < 1) {
    return [];
  }
  const lat = pov?.lat ?? 0;
  const lng = pov?.lng ?? 0;
  const alt = Math.max(0, pov?.altitude ?? 0);

  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  let normLng = (lng + 180) % 360;
  if (normLng < 0) {
    normLng += 360;
  }
  normLng -= 180;

  const capRadius = Math.acos(1 / (1 + alt)) + HORIZON_MARGIN_RAD;
  const capDeg = capRadius * RAD_TO_DEG;
  const dim = 2 ** level;

  const minLat = Math.max(-MAX_MERCATOR_LAT, clampedLat - capDeg);
  const maxLat = Math.min(MAX_MERCATOR_LAT, clampedLat + capDeg);

  const minY = Math.max(0, Math.floor(latToMercatorY(maxLat, level)) - 1);
  const maxY = Math.min(dim - 1, Math.floor(latToMercatorY(minLat, level)) + 1);

  const dLngDeg = computeLongitudeSpan(capRadius, clampedLat * DEG_TO_RAD) + 360 / dim;
  const candidates = [];
  const seen = new Set();
  const maxTileRadius = (Math.SQRT2 * Math.PI) / dim;

  const xSpan = Math.min(dim, Math.ceil((dLngDeg * 2 * dim) / 360) + 1);
  const startX = Math.floor(lonToTileX(normLng - dLngDeg, level));

  for (let dy = minY; dy <= maxY; dy++) {
    const tileLat = mercatorYToLat(dy + 0.5, level);
    for (let step = 0; step <= xSpan; step++) {
      const rawX = startX + step;
      const wrappedX = ((rawX % dim) + dim) % dim;
      const key = `${wrappedX},${dy}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const tileLng = tileXToLon(wrappedX + 0.5, level);
      const dist = haversineDist(clampedLat, normLng, tileLat, tileLng);
      if (dist <= capRadius + maxTileRadius) {
        candidates.push({ z: level, x: wrappedX, y: dy, dist });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, MAX_VISIBLE_TILES).map(({ z, x, y }) => ({ z, x, y }));
}

export function createTileMesh(tile, texture, material) {
  const { z, x, y } = tile;
  const positions = [];
  const uvs = [];
  const globalUvs = [];
  const indices = [];

  for (let i = 0; i <= TILE_SEGMENTS; i++) {
    const yLocal = i / TILE_SEGMENTS;
    const lat = mercatorYToLat(y + yLocal, z);
    const phi = lat * DEG_TO_RAD;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const v = 1 - yLocal;

    for (let j = 0; j <= TILE_SEGMENTS; j++) {
      const xLocal = j / TILE_SEGMENTS;
      const lng = tileXToLon(x + xLocal, z);
      const theta = lng * DEG_TO_RAD;

      const px = SATELLITE_TILE_RADIUS * cosPhi * Math.sin(theta);
      const py = SATELLITE_TILE_RADIUS * sinPhi;
      const pz = SATELLITE_TILE_RADIUS * cosPhi * Math.cos(theta);

      positions.push(px, py, pz);
      uvs.push(xLocal, v);
      // Equirectangular UV of the base globe: keeps the sensor grid continuous.
      globalUvs.push((lng + 180) / 360, (lat + 90) / 180);
    }
  }

  for (let i = 0; i < TILE_SEGMENTS; i++) {
    for (let j = 0; j < TILE_SEGMENTS; j++) {
      const a = i * (TILE_SEGMENTS + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (TILE_SEGMENTS + 1) + j;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("globalUv", new THREE.Float32BufferAttribute(globalUvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mat = material || new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.tileKey = `${z}/${x}/${y}`;
  mesh.renderOrder = 0;

  return mesh;
}
