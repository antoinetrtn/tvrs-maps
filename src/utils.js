
import { GAME_REGIONS } from "./gameConfig";
import { GLITCH_EFFECT_SETTINGS } from "./designSystem";

/**
 * Normalizes input string for accents, lowercase, hyphens, and whitespace.
 */
export const normalizeString = (str) => {
  if (!str) return "";
  const normalized = str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.replace(/[-']/g, " ").replace(/\s+/g, " ").trim();
};

/**
 * Formats seconds into a "m:ss" display string (e.g. 65 → "1:05").
 */
export function formatTime(totalSeconds) {
  if (!totalSeconds && totalSeconds !== 0) return "--:--";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Scramble text with glitched characters for text animations.
 */
export const scrambleText = (text, seed = 0) => {
  if (!text) return "";
  const glyphs = GLITCH_EFFECT_SETTINGS.asciiScramble.glyphs;
  return text
    .split("")
    .map((char, index) => {
      if (char === " " || char === "-" || char === "'") return char;
      const hash = Math.sin(index * 13.5 + seed * 7.1) * 10000;
      const rand = Math.abs(hash) % 1.0;
      const glyphIndex = Math.floor(rand * glyphs.length);
      return glyphs[glyphIndex];
    })
    .join("");
};

export const getGameStats = (foundList, countryDataMap, lang = 'fr') => {
  const baseOrder = GAME_REGIONS;
  const dynamicRegions = Object.values(countryDataMap)
    .map(item => item?.region)
    .filter(Boolean);
  const CONTINENT_ORDER = Array.from(new Set([...baseOrder, ...dynamicRegions]));
  const s = {};
  CONTINENT_ORDER.forEach(reg => s[reg] = { total: 0, found: 0, countries: [] });
  
  Object.keys(countryDataMap).forEach(k => {
    const country = countryDataMap[k];
    let reg = country?.region;
    if (!reg || !s[reg]) reg = 'Unknown';
    
    s[reg].total++;
    const isFound = foundList.includes(k);
    if (isFound) s[reg].found++;
    s[reg].countries.push({
      key: k,
      found: isFound,
      name: lang === 'fr' ? (country.name_fr || k) : (country.name_en || k),
      capital: lang === 'fr' ? (country.capital_fr || country.capital) : country.capital
    });
  });

  CONTINENT_ORDER.forEach(reg => {
    s[reg].countries.sort((a, b) => {
      if (a.found !== b.found) return a.found ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  return { stats: s, CONTINENT_ORDER };
};

export const getFlagEmoji = (iso2) => {
  if (!iso2 || iso2.length !== 2) return "";
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
};

export const getFeaturePolygons = (feature) => {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
};

export const areLngLatPointsEqual = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length >= 2 &&
  b.length >= 2 &&
  a[0] === b[0] &&
  a[1] === b[1];

export const getCleanRingForRendering = (ring) => {
  if (!Array.isArray(ring)) return null;

  const cleanRing = ring.reduce((points, point) => {
    if (!Array.isArray(point) || point.length < 2) return points;
    const normalizedPoint = [Number(point[0]), Number(point[1])];
    if (
      !Number.isFinite(normalizedPoint[0]) ||
      !Number.isFinite(normalizedPoint[1])
    )
      return points;
    if (
      points.length &&
      areLngLatPointsEqual(points[points.length - 1], normalizedPoint)
    )
      return points;
    points.push(normalizedPoint);
    return points;
  }, []);

  if (cleanRing.length < 3) return null;

  if (!areLngLatPointsEqual(cleanRing[0], cleanRing[cleanRing.length - 1])) {
    cleanRing.push([...cleanRing[0]]);
  }

  return cleanRing.length >= 4 ? cleanRing : null;
};

export const getExteriorPolygonForRendering = (polygon) => {
  const exteriorRing = getCleanRingForRendering(polygon?.[0]);
  return exteriorRing ? [exteriorRing] : null;
};

export const getRenderGeometry = (feature) => {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  if (geometry.type === "Polygon") {
    const coordinates = getExteriorPolygonForRendering(geometry.coordinates);
    if (!coordinates) return null;
    return {
      ...geometry,
      coordinates,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const coordinates = geometry.coordinates
      .map(getExteriorPolygonForRendering)
      .filter(Boolean);
    if (!coordinates.length) return null;
    return {
      ...geometry,
      coordinates,
    };
  }

  return geometry;
};

export const getLngLatBounds = (polygons) => {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });
    });
  });

  return { minLng, maxLng, minLat, maxLat };
};

export const pointInBounds = (lng, lat, bounds) => {
  return (
    lng >= bounds.minLng &&
    lng <= bounds.maxLng &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat
  );
};

const pointInRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngI, latI] = ring[i];
    const [lngJ, latJ] = ring[j];
    const intersects =
      latI > lat !== latJ > lat &&
      lng <
        ((lngJ - lngI) * (lat - latI)) / (latJ - latI || Number.EPSILON) + lngI;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const pointInPolygon = (lng, lat, polygon) => {
  if (!polygon?.length || !pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
};

export const featureContainsLngLat = (featureIndexEntry, lng, lat) => {
  if (!pointInBounds(lng, lat, featureIndexEntry.bounds)) return false;
  return featureIndexEntry.polygons.some((polygon) =>
    pointInPolygon(lng, lat, polygon),
  );
};

export const getLngLatDistance = (lngA, latA, lngB, latB) => {
  let dLng = Math.abs(lngA - lngB);
  if (dLng > 180) dLng = 360 - dLng;
  return Math.hypot(dLng, latA - latB);
};

export const getMobileRenderRadius = (zoomLevel) => {
  if (zoomLevel >= 1.6) return 118;
  if (zoomLevel >= 1.05) return 96;
  if (zoomLevel >= 0.7) return 78;
  return 64;
};

export const getLabelRenderRadius = (zoomLevel, isMobile) => {
  if (isMobile) return getMobileRenderRadius(zoomLevel) * 0.82;
  if (zoomLevel >= 2.4) return 38;
  if (zoomLevel >= 1.6) return 58;
  if (zoomLevel >= 1.05) return 78;
  return 96;
};

/**
 * Extract administrative code or name from a GeoJSON feature's properties.
 */
export const getFeatureAdmin = (feature) => {
  if (!feature || !feature.properties) return undefined;
  const props = feature.properties;
  
  // Custom mapping for Somaliland to Somalia
  if (props.ADMIN === "Somaliland") return "Somalia";
  
  return props.code || props.ADMIN || props.name || props.NAME;
};
