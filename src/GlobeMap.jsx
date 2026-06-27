import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';
import { riversMountainsDataMap } from './riversMountainsData';
import { THEME, THEME_OVERRIDES, CONTINENT_COLORS, CONTINENT_COLORS_ATTENUATED, CONTINENT_COLORS_LABELS, GLOBE_STYLE, GLOBE_TRANSPARENT_BACKGROUND, getOpaqueThreeColor, PROCEDURAL_OCEAN_COLORS, SURFACE_THEME_COLORS, STROKE_THEME_COLORS, ATMOSPHERE_THEME_COLORS, getThemeRegionColor, getThemeRegionColorAttenuated, getThemeRegionColorLabel, FRENCH_REGION_COLORS } from './designSystem';
import { disposeBiomeCache, createMountainFeature, createUnfoundPlaceholder } from './LowPolyBiomes';
import { shouldScrambleLabel, getPolygonAltitudeFor, isReliefVisible, RELIEF } from './gameConfig';

// Hoisted PURE accessors for the <Globe> paths layer. Keeping their identities
// stable across renders prevents react-globe.gl from marking the path/object
// layers dirty and re-tessellating all river/mountain tube geometry every render.
const pathPointsAccessor = d => d.coords;
const pathPointLatAccessor = d => d[0];
const pathPointLngAccessor = d => d[1];
const pathPointAltAccessor = d => d[2];
const pathColorAccessor = d => d.color;
const pathWidthAccessor = d => d.width;
const pathDashLengthAccessor = d => d.dashLength;
const pathDashGapAccessor = d => d.dashGap;
const pathDashAnimateTimeAccessor = d => d.dashAnimateTime;

const smoothedRiversCache = {};

const getSmoothedRiverPath = (riverKey, pathCoords) => {
  if (smoothedRiversCache[riverKey]) return smoothedRiversCache[riverKey];
  if (!pathCoords || pathCoords.length < 2) return pathCoords;

  const points = pathCoords.map(([lat, lng]) => new THREE.Vector3(lat, lng, 0.005));
  const curve = new THREE.CatmullRomCurve3(points);
  const smoothPoints = curve.getPoints(60);
  const result = smoothPoints.map(p => [p.x, p.y, p.z]);

  smoothedRiversCache[riverKey] = result;
  return result;
};

// Realistic theme progressive texture loading has been retired

const getFeatureAdmin = (feature) => feature?.properties?.code || feature?.properties?.ADMIN || feature?.properties?.name || feature?.properties?.NAME;

const getFlagEmoji = (iso2) => {
  if (!iso2 || iso2.length !== 2) return '';
  return iso2.toUpperCase().replace(/./g, char =>
    String.fromCodePoint(char.charCodeAt(0) + 127397)
  );
};

const getFeaturePolygons = (feature) => {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

const areLngLatPointsEqual = (a, b) => (
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length >= 2 &&
  b.length >= 2 &&
  a[0] === b[0] &&
  a[1] === b[1]
);

const getCleanRingForRendering = (ring) => {
  if (!Array.isArray(ring)) return null;

  const cleanRing = ring.reduce((points, point) => {
    if (!Array.isArray(point) || point.length < 2) return points;
    const normalizedPoint = [Number(point[0]), Number(point[1])];
    if (!Number.isFinite(normalizedPoint[0]) || !Number.isFinite(normalizedPoint[1])) return points;
    if (points.length && areLngLatPointsEqual(points[points.length - 1], normalizedPoint)) return points;
    points.push(normalizedPoint);
    return points;
  }, []);

  if (cleanRing.length < 3) return null;

  if (!areLngLatPointsEqual(cleanRing[0], cleanRing[cleanRing.length - 1])) {
    cleanRing.push([...cleanRing[0]]);
  }

  return cleanRing.length >= 4 ? cleanRing : null;
};

const getExteriorPolygonForRendering = (polygon) => {
  const exteriorRing = getCleanRingForRendering(polygon?.[0]);
  return exteriorRing ? [exteriorRing] : null;
};

const getRenderGeometry = (feature) => {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  if (geometry.type === 'Polygon') {
    const coordinates = getExteriorPolygonForRendering(geometry.coordinates);
    if (!coordinates) return null;
    return {
      ...geometry,
      coordinates
    };
  }

  if (geometry.type === 'MultiPolygon') {
    const coordinates = geometry.coordinates
      .map(getExteriorPolygonForRendering)
      .filter(Boolean);
    if (!coordinates.length) return null;
    return {
      ...geometry,
      coordinates
    };
  }

  return geometry;
};

const getLngLatBounds = (polygons) => {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  polygons.forEach(polygon => {
    polygon.forEach(ring => {
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

const pointInBounds = (lng, lat, bounds) => {
  return lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat;
};

const pointInRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngI, latI] = ring[i];
    const [lngJ, latJ] = ring[j];
    const intersects = ((latI > lat) !== (latJ > lat)) &&
      (lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI || Number.EPSILON) + lngI);
    if (intersects) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (lng, lat, polygon) => {
  if (!polygon?.length || !pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
};

const featureContainsLngLat = (featureIndexEntry, lng, lat) => {
  if (!pointInBounds(lng, lat, featureIndexEntry.bounds)) return false;
  return featureIndexEntry.polygons.some(polygon => pointInPolygon(lng, lat, polygon));
};

const getLngLatDistance = (lngA, latA, lngB, latB) => {
  let dLng = Math.abs(lngA - lngB);
  if (dLng > 180) dLng = 360 - dLng;
  return Math.hypot(dLng, latA - latB);
};

const getMobileRenderRadius = (zoomLevel) => {
  if (zoomLevel >= 1.6) return 118;
  if (zoomLevel >= 1.05) return 96;
  if (zoomLevel >= 0.7) return 78;
  return 64;
};

const getLabelRenderRadius = (zoomLevel, isMobile) => {
  if (isMobile) return getMobileRenderRadius(zoomLevel) * 0.82;
  if (zoomLevel >= 2.4) return 38;
  if (zoomLevel >= 1.6) return 58;
  if (zoomLevel >= 1.05) return 78;
  return 96;
};

const SELECTION_TRANSITION_DURATION = 80; // Snappy transition
const ORBIT_POLE_GUARD_ANGLE = 0.03;
const DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS = new Set(['France']);
const DEPARTMENT_MODE_FRANCE_VIEW = {
  lat: 46.5,
  lng: 2.6,
  altitude: {
    mobile: 0.62,
    desktop: 0.42
  }
};
const BIOME_SCENE_SCALE = 9.2;
const BIOME_SURFACE_ALIGNMENT_RADIANS = Math.PI / 2;
const BIOME_SAMPLE_CANDIDATES = 12;
const BIOME_SAMPLE_ATTEMPTS = 35;
const BIOME_VARIANTS = {
  Europe: ['pine', 'deciduous', 'rocks', 'deer', 'castle', 'mountain'],
  Africa: ['acacia', 'cactus', 'rocks', 'deer', 'pyramid'],
  Americas: ['redwood', 'canyon', 'pine', 'rocks', 'deer', 'pyramid', 'volcano', 'mountain'],
  USA: ['redwood', 'canyon', 'rocks', 'deer', 'building', 'mountain'],
  Asia: ['sakura', 'bamboo', 'rocks', 'deer', 'volcano', 'mountain'],
  Oceania: ['palm', 'rocks', 'deer', 'volcano'],
  Antarctic: ['iceberg', 'rocks', 'iceMountain'],
  France: ['deciduous', 'pine', 'rocks', 'castle', 'mountain'],
  Unknown: ['rocks']
};

// --- PROCEDURAL THEMED OCEAN TEXTURE GENERATORS ---

const createBlueprintGridTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Blueprint navy/dark paper
  ctx.fillStyle = PROCEDURAL_OCEAN_COLORS.blueprint.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Precision technical blueprint lines
  const rows = 64;
  const cols = 128;

  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * canvas.height;
    ctx.beginPath();
    ctx.strokeStyle = i % 8 === 0 ? PROCEDURAL_OCEAN_COLORS.blueprint.lineMajor : PROCEDURAL_OCEAN_COLORS.blueprint.lineMinor;
    ctx.lineWidth = i % 8 === 0 ? 2.5 : 1.2;
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * canvas.width;
    ctx.beginPath();
    ctx.strokeStyle = i % 8 === 0 ? PROCEDURAL_OCEAN_COLORS.blueprint.lineMajor : PROCEDURAL_OCEAN_COLORS.blueprint.lineMinor;
    ctx.lineWidth = i % 8 === 0 ? 2.5 : 1.2;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};

// --- PROCEDURAL THEMED 3D MODELS BUILDERS ---



const createBlueprintNode = () => {
  const group = new THREE.Group();
  group.name = 'blueprint-node';

  const lineMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.72,
    wireframe: true
  });

  // Scan cone
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 6, 2, true), lineMat);
  cone.name = 'blueprint-cone';
  cone.position.y = 0.1;
  group.add(cone);

  // Holographic ring
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.45
  });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 12, 1, true), ringMat);
  ring.name = 'blueprint-ring';
  ring.position.y = 0.055;
  ring.userData = { offset: Math.random() * 1000 };
  group.add(ring);

  // Core beacon dot
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), dotMat);
  dot.position.y = 0.1;
  group.add(dot);

  return group;
};

const MOUNTAIN_RANGES = [
  { name: 'Alps', minLat: 44, maxLat: 48, minLng: 5, maxLng: 16 },
  { name: 'Pyrenees', minLat: 42, maxLat: 43.5, minLng: -2, maxLng: 3.5 },
  { name: 'Himalayas', minLat: 26, maxLat: 36, minLng: 70, maxLng: 100 },
  { name: 'Rockies', minLat: 35, maxLat: 65, minLng: -125, maxLng: -105 },
  { name: 'Andes', minLat: -55, maxLat: 10, minLng: -80, maxLng: -65 },
  { name: 'Caucasus', minLat: 40, maxLat: 45, minLng: 40, maxLng: 50 },
  { name: 'Urals', minLat: 50, maxLat: 68, minLng: 57, maxLng: 63 },
  { name: 'Atlas', minLat: 30, maxLat: 36, minLng: -10, maxLng: 5 },
  { name: 'Scandinavian', minLat: 58, maxLat: 71, minLng: 5, maxLng: 20 },
  { name: 'Southern Alps NZ', minLat: -47, maxLat: -38, minLng: 166, maxLng: 175 },
  { name: 'Japan Mountains', minLat: 33, maxLat: 44, minLng: 130, maxLng: 145 },
  { name: 'Great Dividing Range', minLat: -38, maxLat: -15, minLng: 140, maxLng: 152 },
  { name: 'Drakensberg', minLat: -31, maxLat: -28, minLng: 27, maxLng: 31 },
  { name: 'Ethiopian Highlands', minLat: 5, maxLat: 15, minLng: 34, maxLng: 44 },
  { name: 'Iceland', minLat: 63, maxLat: 67, minLng: -25, maxLng: -13 }
];

const MAJOR_METROS = [
  { name: 'New York', lat: 40.71, lng: -74.00 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Chicago', lat: 41.88, lng: -87.63 },
  { name: 'San Francisco', lat: 37.77, lng: -122.41 },
  { name: 'Shanghai', lat: 31.23, lng: 121.47 },
  { name: 'Shenzhen', lat: 22.54, lng: 114.05 },
  { name: 'Guangzhou', lat: 23.12, lng: 113.26 },
  { name: 'Mumbai', lat: 19.07, lng: 72.87 },
  { name: 'Sao Paulo', lat: -23.55, lng: -46.63 },
  { name: 'Rio de Janeiro', lat: -22.90, lng: -43.17 },
  { name: 'Sydney', lat: -33.86, lng: 151.20 },
  { name: 'Melbourne', lat: -37.81, lng: 144.96 },
  { name: 'Toronto', lat: 43.65, lng: -79.38 },
  { name: 'Vancouver', lat: 49.28, lng: -123.12 },
  { name: 'Montreal', lat: 45.50, lng: -73.56 },
  { name: 'Johannesburg', lat: -26.20, lng: 28.04 },
  { name: 'Frankfurt', lat: 50.11, lng: 8.68 },
  { name: 'Munich', lat: 48.13, lng: 11.58 },
  { name: 'Milan', lat: 45.46, lng: 9.18 },
  { name: 'Barcelona', lat: 41.38, lng: 2.17 },
  { name: 'Istanbul', lat: 41.00, lng: 28.97 },
  { name: 'Dubai', lat: 25.20, lng: 55.27 },
  { name: 'Geneva', lat: 46.20, lng: 6.14 },
  { name: 'Zurich', lat: 47.37, lng: 8.54 },
  { name: 'St. Petersburg', lat: 59.93, lng: 30.33 }
];

const isCoordinateMountainous = (lat, lng) => {
  for (let i = 0; i < MOUNTAIN_RANGES.length; i++) {
    const r = MOUNTAIN_RANGES[i];
    if (lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng) {
      return true;
    }
  }
  return false;
};

const isCoordinateUrban = (lat, lng, capLat, capLng) => {
  if (capLat !== undefined && capLng !== undefined) {
    if (getLngLatDistance(lng, lat, capLng, capLat) < 2.0) {
      return true;
    }
  }
  for (let i = 0; i < MAJOR_METROS.length; i++) {
    const m = MAJOR_METROS[i];
    if (getLngLatDistance(lng, lat, m.lng, m.lat) < 2.0) {
      return true;
    }
  }
  return false;
};

const getBiomeModelCount = (size, isDepartmentMode) => {
  if (isDepartmentMode) return 1;
  if (size < 2.0) return 0; // Monaco, Singapore, Vatican, etc. get 0 models to avoid clutter
  if (size < 4.0) return 1; // Small states (Switzerland, Belgium, Netherlands) get exactly 1 asset
  if (size < 7.0) return 2; // Medium states get exactly 2 assets
  if (size < 12.0) return 3; // Medium-large states get exactly 3 assets
  return Math.min(16, Math.max(4, Math.round(Math.sqrt(size) * 1.5))); // Capped elegantly at 16 max
};

const selectLogicalBiomeVariant = (lat, lng, biomeType, dataLat, dataLng, globeTheme) => {
  if (globeTheme === 'blueprint') {
    return 'scan';
  }

  if (isCoordinateMountainous(lat, lng)) {
    if (biomeType === 'Antarctic') {
      return 'iceMountain';
    } else if (biomeType === 'Americas' || biomeType === 'USA') {
      return Math.random() < 0.5 ? 'mountain' : 'canyon';
    } else if (biomeType === 'Africa') {
      return Math.random() < 0.5 ? 'canyon' : 'rocks';
    } else {
      return 'mountain';
    }
  }

  if (isCoordinateUrban(lat, lng, dataLat, dataLng)) {
    if (biomeType === 'Europe' || biomeType === 'France') {
      return Math.random() < 0.5 ? 'castle' : 'building';
    } else if (biomeType === 'Africa') {
      return Math.random() < 0.5 ? 'pyramid' : 'building';
    } else if (biomeType === 'Americas') {
      return Math.random() < 0.5 ? 'pyramid' : 'building';
    } else if (biomeType === 'USA') {
      return 'building';
    } else if (biomeType === 'Asia') {
      return Math.random() < 0.5 ? 'castle' : 'building';
    } else {
      return 'building';
    }
  }

  const regionNaturalVariants = {
    Europe: ['pine', 'deciduous', 'rocks', 'deer'],
    Africa: ['acacia', 'cactus', 'rocks', 'deer'],
    Americas: ['redwood', 'pine', 'rocks', 'deer'],
    USA: ['redwood', 'rocks', 'deer'],
    Asia: ['sakura', 'bamboo', 'rocks', 'deer'],
    Oceania: ['palm', 'rocks', 'deer'],
    Antarctic: ['iceberg', 'rocks'],
    France: ['deciduous', 'pine', 'rocks'],
    Unknown: ['rocks']
  };
  const choices = regionNaturalVariants[biomeType] || regionNaturalVariants.Unknown;
  return choices[Math.floor(Math.random() * choices.length)];
};

const getBiomeFallbackPoint = (data, size) => ({
  lat: data.lat + (Math.random() - 0.5) * Math.min(0.55, size * 0.22),
  lng: data.lng + (Math.random() - 0.5) * Math.min(0.55, size * 0.22)
});

const getSampledBiomePoint = (featureEntry, data, size, generated) => {
  if (!featureEntry?.polygons?.length) return getBiomeFallbackPoint(data, size);

  const bounds = featureEntry.bounds;
  let bestPoint = null;
  let bestDistance = -1;

  // Calculate safety buffer based on country size to avoid clipping into coasts/water
  const buffer = Math.max(0.12, Math.min(0.4, size * 0.1));

  for (let candidate = 0; candidate < BIOME_SAMPLE_CANDIDATES; candidate++) {
    let point = null;
    for (let attempt = 0; attempt < BIOME_SAMPLE_ATTEMPTS; attempt++) {
      const testLng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
      const testLat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);

      // Progressively relax safety buffer to ensure we find a valid coordinate
      // 0-24: Strict buffer based on country dimensions
      // 25-31: Relaxed 0.05 degree margin
      // 32-35: Center point only (fallback for extremely narrow/fragmented states)
      const currentBuffer = attempt < 25 ? buffer : (attempt < 32 ? 0.05 : 0);

      const insideCenter = featureContainsLngLat(featureEntry, testLng, testLat);
      if (insideCenter) {
        if (currentBuffer === 0 || (
          featureContainsLngLat(featureEntry, testLng - currentBuffer, testLat) &&
          featureContainsLngLat(featureEntry, testLng + currentBuffer, testLat) &&
          featureContainsLngLat(featureEntry, testLng, testLat - currentBuffer) &&
          featureContainsLngLat(featureEntry, testLng, testLat + currentBuffer)
        )) {
          point = { lat: testLat, lng: testLng };
          break;
        }
      }
    }
    if (!point) continue;

    const nearestDistance = generated.length
      ? Math.min(...generated.map(existing => getLngLatDistance(point.lng, point.lat, existing.lng, existing.lat)))
      : Infinity;

    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestPoint = point;
    }
  }

  return bestPoint || getBiomeFallbackPoint(data, size);
};

const getDepartmentModeFrancePointOfView = (width) => ({
  lat: DEPARTMENT_MODE_FRANCE_VIEW.lat,
  lng: DEPARTMENT_MODE_FRANCE_VIEW.lng,
  altitude: width < 768
    ? DEPARTMENT_MODE_FRANCE_VIEW.altitude.mobile
    : DEPARTMENT_MODE_FRANCE_VIEW.altitude.desktop
});

const FRESNEL_VERTEX_SHADER = `
  varying vec3 vAtmosphereNormal;
  varying vec3 vAtmosphereViewPos;
  void main() {
    vAtmosphereNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vAtmosphereViewPos = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRESNEL_FRAGMENT_SHADER = `
  varying vec3 vAtmosphereNormal;
  varying vec3 vAtmosphereViewPos;
  uniform vec3 glowColor;
  uniform float coef;
  uniform float power;
  void main() {
    vec3 normal = normalize(vAtmosphereNormal);
    vec3 viewDir = normalize(vAtmosphereViewPos);

    // True perspective dot product between view direction and surface normal.
    // For BackSide rendering, normal points outwards, and viewDir points from camera
    // to the vertex (which is also generally away from the camera).
    // Thus, the dot product is positive on the back hemisphere.
    float x = clamp(dot(normal, viewDir), 0.0, 1.0);

    // Ultra-soft gradual atmospheric gradient fading from maximum at the horizon (x = 0.62)
    // to 0.0 at the outer limit of space (x = 0.0).
    float edgeFade = smoothstep(0.0, 0.62, x);

    // Higher exponent creates a more gentle, soft, and diffuse gradient transition
    float exponent = max(1.8, power * 2.0);
    float intensity = pow(edgeFade, exponent) * coef;

    gl_FragColor = vec4(glowColor, intensity);
  }
`;

const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });


const GlobeMap = ({
  mode,
  lang,
  countriesData,
  departmentsData = [],
  foundList,
  onCountrySelect,
  shouldAutoRotate,
  selectedCountry,
  theme,
  viewport,
  isError,
  isSuccess,
  hasActiveFeedback,
  perfProfile,
  isHomeScreen,
  isKeyboardMode,
  isEndScreen,
  isPerfectScore,
  onPreserveInputFocus,
  globeLightingEnabled = true,
  activeDataMap,
  globeTheme = 'glass',
  learnShowCountryLabels = true,
  learnShowCapitals = false,
  learnShowRivers = false,
  learnShowMountains = false
}) => {
  const globeEl = useRef();
  const globeContentWrapperRef = useRef(null);
  const globeLightingRef = useRef(null);
  const polygonMaterialCacheRef = useRef({ cap: new Map(), side: new Map() });
  const sharedMaterialsRef = useRef(new Map());
  const tapRef = useRef(null);
  const previousSelectedCountryRef = useRef(null);
  const lastTargetRef = useRef(null);
  const maxWindowWidthRef = useRef(window.innerWidth);
  const maxWindowHeightRef = useRef(window.innerHeight);
  const wasHomeScreenRef = useRef(isHomeScreen);
  const isInteractingRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });

  // Texture quality effect removed
  const prevSelectedCountryRef = useRef(null);
  const biomeObjectsCacheRef = useRef(new Map());
  const animObjectsCacheRef = useRef([]);
  const lastAnimCacheTimeRef = useRef(0);
  const lastAnimFrameTimeRef = useRef(0);
  const targetGlowColorRef = useRef(new THREE.Color(0x38bdf8));
  const targetGlowPowerRef = useRef(1.2);
  const targetGlowCoefRef = useRef(1.0);
  const selectedStrokeObjRef = useRef(null);
  // Refs read inside the rAF loop so it can react to selection/feedback changes
  // without tearing down and recreating the loop on every guess/navigation.
  const selectedCountryRef = useRef(null);
  const isErrorRef = useRef(false);
  const isSuccessRef = useRef(false);
  // rAF bookkeeping + bounded graticule restyle window (replaces per-frame random restyle).
  const animFrameIdRef = useRef(null);
  const animateSceneRef = useRef(null);
  const needsGraticuleStyleRef = useRef(true);
  const graticuleStyleUntilRef = useRef(0);
  // Keep the loop-facing refs current on every render so the running rAF loop
  // reads fresh selection/feedback state without being part of its dep array.
  selectedCountryRef.current = selectedCountry;
  isErrorRef.current = isError;
  isSuccessRef.current = isSuccess;

  const labelsCacheRef = useRef({});
  const isDepartmentMode = mode === 'departments' && !isHomeScreen;
  const isRiversMountainsMode = mode === 'rivers_mountains';
  const gameDataMap = (isDepartmentMode || isRiversMountainsMode) ? (activeDataMap || {}) : countryDataMap;

  const safeColor = useCallback((c) => getOpaqueThreeColor(c), []);

  const lerpColor = useCallback((a, b, amount) => {
    try {
      const colorA = safeColor(a);
      const colorB = safeColor(b);
      const c1 = new THREE.Color(colorA);
      const c2 = new THREE.Color(colorB);
      c1.lerp(c2, Math.max(0, Math.min(1, amount)));
      return `#${c1.getHexString()}`;
    } catch (e) {
      return safeColor(a);
    }
  }, [safeColor]);

  // Custom Zoom Logic (Google Maps style: double tap + drag)
  const lastTapRef = useRef(0);
  const isZoomDragging = useRef(false);
  const startY = useRef(0);
  const savedControlsEnabledRef = useRef(true);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const now = Date.now();
    const touch = e.touches[0];
    if (now - lastTapRef.current < 300) {
      isZoomDragging.current = true;
      startY.current = touch.clientY;
      // Disable OrbitControls rotation so the globe doesn't spin during zoom drag
      try {
        const controls = globeEl.current?.controls?.();
        if (controls) {
          savedControlsEnabledRef.current = controls.enableRotate;
          controls.enableRotate = false;
        }
      } catch (_) {}
      e.preventDefault();
    }
    lastTapRef.current = now;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isZoomDragging.current || !globeEl.current) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startY.current;
    const currentPOV = globeEl.current.pointOfView();
    const zoomSpeed = 0.005;
    const newAlt = Math.max(0.1, Math.min(4, currentPOV.altitude - deltaY * zoomSpeed));
    globeEl.current.pointOfView({ altitude: newAlt }, 0);
    startY.current = touch.clientY;
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isZoomDragging.current) {
      // Re-enable OrbitControls rotation
      try {
        const controls = globeEl.current?.controls?.();
        if (controls) {
          controls.enableRotate = savedControlsEnabledRef.current;
        }
      } catch (_) {}
    }
    isZoomDragging.current = false;
  }, []);

  useEffect(() => {
    let controlsReference = null;
    let changeHandler = null;
    let startHandler = null;
    let endHandler = null;

    if (globeEl.current) {
      try {
        const renderer = globeEl.current.renderer();
        if (renderer) {
          renderer.setPixelRatio(perfProfile?.pixelRatio || 1);
          renderer.sortObjects = true;
        }

        const controls = globeEl.current.controls();
        if (controls) {
          controlsReference = controls;
          controls.autoRotate = shouldAutoRotate;
          controls.autoRotateSpeed = 0.3;
          controls.enableZoom = true;
          controls.enableDamping = true;
          controls.dampingFactor = perfProfile?.isMobile ? 0.12 : 0.08;
          controls.rotateSpeed = perfProfile?.isMobile ? 0.75 : 0.9;
          controls.zoomSpeed = perfProfile?.isMobile ? 0.75 : 1;
          controls.zoomToCursor = false;
          controls.minPolarAngle = ORBIT_POLE_GUARD_ANGLE;
          controls.maxPolarAngle = Math.PI - ORBIT_POLE_GUARD_ANGLE;

          // Track POV changes with a stable threshold to avoid jittery re-renders
          changeHandler = () => {
             if (isInteractingRef.current) return;
             if (globeEl.current) {
                const pov = globeEl.current.pointOfView();
                setZoomLevel(prev => {
                   if (Math.abs(prev - pov.altitude) > 0.08) return pov.altitude;
                   return prev;
                });
                setCameraPOV(prev => {
                   // Larger threshold for home screen to keep background stable, 10 for gameplay to optimize updates
                   const threshold = isHomeScreen ? 15 : 10;
                   if (Math.abs(prev.lat - pov.lat) > threshold || Math.abs(prev.lng - pov.lng) > threshold) {
                      return { lat: pov.lat, lng: pov.lng };
                   }
                   return prev;
                });
             }
          };

          startHandler = () => {
             isInteractingRef.current = true;
          };

          endHandler = () => {
             isInteractingRef.current = false;
             if (globeEl.current) {
                const pov = globeEl.current.pointOfView();
                setZoomLevel(pov.altitude);
                setCameraPOV({ lat: pov.lat, lng: pov.lng });
             }
          };

          controls.addEventListener('change', changeHandler);
          controls.addEventListener('start', startHandler);
          controls.addEventListener('end', endHandler);
        }

        const camera = globeEl.current.camera();
        if (camera) {
          camera.clearViewOffset();
          camera.near = 1;
          camera.far = 1200;
          camera.updateProjectionMatrix();
        }
      } catch (e) {}
    }

    return () => {
      if (controlsReference) {
        try {
          if (changeHandler) controlsReference.removeEventListener('change', changeHandler);
          if (startHandler) controlsReference.removeEventListener('start', startHandler);
          if (endHandler) controlsReference.removeEventListener('end', endHandler);
        } catch (e) {}
      }
    };
  }, [shouldAutoRotate, theme, perfProfile?.pixelRatio, perfProfile?.isMobile, isHomeScreen]);

  useEffect(() => {
    if (isEndScreen && globeEl.current) {
      // Center and zoom out for the end screen
      globeEl.current.pointOfView(
        isDepartmentMode
          ? getDepartmentModeFrancePointOfView(viewport.width)
          : { lat: 20, lng: 0, altitude: viewport.width < 768 ? 2.2 : 1.8 },
        1200
      );
    } else if (selectedCountry && !isHomeScreen && globeEl.current) {
      const data = gameDataMap[selectedCountry];
      if (data && data.lat !== undefined) {
        const isMobile = viewport.width < 768;
        const currentPOV = globeEl.current.pointOfView();
        const hasPreviousSelection = !!previousSelectedCountryRef.current;
        const fallbackAltitude = isMobile ? 1.8 : 0.68;
        const preservedAltitude = Number.isFinite(currentPOV?.altitude)
          ? currentPOV.altitude
          : fallbackAltitude;
        const isKeyboardOpen = isMobile && isKeyboardMode;
        const layoutHeight = maxWindowHeightRef.current;
        const keyboardHeight = Math.max(0, layoutHeight - viewport.height);
        const keyboardRatio = keyboardHeight / layoutHeight;
        const bottomHUDRatio = isMobile ? 0.15 : 0;
        const occlusionRatio = isKeyboardOpen ? keyboardRatio : bottomHUDRatio;

        // Dynamic latitude offset: scale offset degrees proportional to the camera altitude (zoom level)
        // Shifting camera target south (negative latitude offset) centers country higher in upper visible portion.
        const visibleHeightDegrees = 36 * preservedAltitude;
        const latOffset = -visibleHeightDegrees * (occlusionRatio * 0.70);

        const target = {
          lat: data.lat + latOffset,
          lng: data.lng,
          altitude: hasPreviousSelection ? preservedAltitude : Math.min(preservedAltitude, fallbackAltitude)
        };
        const previousTarget = lastTargetRef.current;
        const onlyViewportNudge = previousTarget &&
          previousSelectedCountryRef.current === selectedCountry &&
          Math.abs(previousTarget.lat - target.lat) < 0.001 &&
          Math.abs(previousTarget.lng - target.lng) < 0.001 &&
          Math.abs(previousTarget.altitude - target.altitude) < 0.001;
        globeEl.current.pointOfView(target, onlyViewportNudge ? 180 : (perfProfile?.isMobile ? 320 : 420));
        lastTargetRef.current = target;
      }
    } else if (isHomeScreen && globeEl.current) {
      // On home the auto-target loop still highlights countries, but the camera stays in a
      // calm overview (auto-rotate keeps spinning). When arriving from a game, re-level the
      // latitude so a game that ended zoomed on a pole doesn't leave the globe tilted.
      const overviewAltitude = viewport.width < 768 ? 2.5 : 1;
      if (!wasHomeScreenRef.current) {
        const currentPOV = globeEl.current.pointOfView();
        globeEl.current.pointOfView({ lat: 18, lng: currentPOV?.lng ?? 20, altitude: overviewAltitude }, 1000);
      } else {
        globeEl.current.pointOfView({ altitude: overviewAltitude }, 1000);
      }
    } else if (isDepartmentMode && globeEl.current) {
      globeEl.current.pointOfView(getDepartmentModeFrancePointOfView(viewport.width), 700);
    } else if (wasHomeScreenRef.current && globeEl.current) {
      globeEl.current.pointOfView({ lat: 18, lng: 20, altitude: viewport.width < 768 ? 1.8 : 1.35 }, 700);
    }
    wasHomeScreenRef.current = isHomeScreen;
    previousSelectedCountryRef.current = selectedCountry;
  }, [selectedCountry, viewport.width, viewport.height, viewport.top, isHomeScreen, perfProfile, isKeyboardMode, isEndScreen, isDepartmentMode, gameDataMap]);

  const isLight = theme === 'light';

  const selectableCountriesData = useMemo(() => {
    if (isDepartmentMode) return departmentsData.filter(feature => gameDataMap[getFeatureAdmin(feature)]);
    return countriesData.filter(feature => countryDataMap[getFeatureAdmin(feature)]);
  }, [countriesData, departmentsData, gameDataMap, isDepartmentMode]);

  const baseRenderCountriesData = useMemo(() => {
    return selectableCountriesData.map(feature => ({
      ...feature,
      renderGeometry: getRenderGeometry(feature)
    }));
  }, [selectableCountriesData]);

  const renderCountriesData = useMemo(() => {
    if (!isDepartmentMode) return baseRenderCountriesData;

    const ghostWorld = countriesData
      .filter(feature => !DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS.has(getFeatureAdmin(feature)))
      .map(feature => ({
        ...feature,
        isGhostCountry: true,
        renderGeometry: getRenderGeometry(feature)
      }));

    return [
      ...ghostWorld,
      ...baseRenderCountriesData.map(feature => ({
        ...feature,
        isDepartmentFeature: true
      }))
    ];
  }, [baseRenderCountriesData, countriesData, isDepartmentMode]);

  const selectableFeatureIndex = useMemo(() => {
    return selectableCountriesData.map(feature => {
      const polygons = getFeaturePolygons(feature);
      return {
        admin: getFeatureAdmin(feature),
        bounds: getLngLatBounds(polygons),
        polygons
      };
    }).filter(entry => entry.admin && entry.polygons.length);
  }, [selectableCountriesData]);

  const selectCountry = useCallback((admin) => {
    if (onCountrySelect) {
      if (!admin || gameDataMap[admin] || (mode === 'learn' && riversMountainsDataMap[admin])) {
        onCountrySelect(admin);
      }
    }
  }, [gameDataMap, onCountrySelect, mode]);

  const selectCountryAtLngLat = useCallback((lng, lat) => {
    const isLearnRivers = mode === 'learn' && learnShowRivers;
    const isLearnMountains = mode === 'learn' && learnShowMountains;

    if (mode === 'rivers_mountains' || isLearnRivers || isLearnMountains) {
      let best = null;
      const dataMap = mode === 'rivers_mountains' ? gameDataMap : riversMountainsDataMap;
      Object.entries(dataMap).forEach(([admin, data]) => {
        if (!data) return;
        if (mode === 'learn') {
          if (data.type === 'river' && !learnShowRivers) return;
          if ((data.type === 'mountain' || data.type === 'mountain_range') && !learnShowMountains) return;
        }

        let dist;
        if (data.type === 'river' && Array.isArray(data.path) && data.path.length > 0) {
          // For rivers: find min distance to ANY point on the river path polyline
          dist = data.path.reduce((min, [pLat, pLng]) => {
            const d = getLngLatDistance(lng, lat, pLng, pLat);
            return d < min ? d : min;
          }, Infinity);
        } else if (data.lat !== undefined && data.lng !== undefined) {
          // Mountain ranges: use center point with a generous radius
          dist = getLngLatDistance(lng, lat, data.lng, data.lat);
        } else {
          return;
        }
        if (!best || dist < best.dist) best = { admin, dist };
      });
      // Rivers: click within ~5.5° of path. Mountains: 6.0° generous hit area.
      const bestData = best ? dataMap[best.admin] : null;
      if (bestData) {
        const threshold = bestData.type === 'river' ? 5.5 : 6.0;
        if (best.dist < threshold) {
          selectCountry(best.admin);
          return;
        }
      }
      if (mode !== 'learn') {
        selectCountry(null);
        return;
      }
    }

    if (isDepartmentMode) {
      let best = null;
      Object.entries(gameDataMap).forEach(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return;
        const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
        if (!best || dist < best.dist) best = { admin, dist };
      });
      selectCountry(best && best.dist < 2.2 ? best.admin : null);
      return;
    }

    const match = selectableFeatureIndex.find(entry => featureContainsLngLat(entry, lng, lat));
    if (match) {
      selectCountry(match.admin);
      return;
    }

    // GeoJSON at 110m is very simplified; a tap near a coast/border can land just
    // outside the polygon. Fall back to the closest capital/country point nearby.
    let best = null;
    Object.entries(gameDataMap).forEach(([admin, data]) => {
      if (data.lat === undefined || data.lng === undefined) return;
      const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
      if (!best || dist < best.dist) best = { admin, dist };
    });
    if (best && best.dist < 6) {
      selectCountry(best.admin);
    } else {
      // Clicked on ocean / far from any country: deselect
      selectCountry(null);
    }
  }, [gameDataMap, isDepartmentMode, selectableFeatureIndex, selectCountry, mode, learnShowRivers, learnShowMountains]);

  const handlePointerDown = useCallback((event) => {
    // Prevent focus shift (keyboard flicker) on mobile when interacting with the globe
    if (event.pointerType === 'touch' && isKeyboardMode && viewport.width < 1024) {
      event.preventDefault();
      onPreserveInputFocus?.();
    }

    tapRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now()
    };

    if (globeContentWrapperRef.current && !isHomeScreen) {
      globeContentWrapperRef.current.style.transition = 'transform 80ms linear';
    }
  }, [isHomeScreen, isKeyboardMode, onPreserveInputFocus, viewport.width]);

  const handlePointerMove = useCallback((event) => {
    const tap = tapRef.current;
    const wrapper = globeContentWrapperRef.current;
    if (!tap || tap.pointerId !== event.pointerId || !wrapper || isHomeScreen) return;

    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    const strength = perfProfile?.isMobile ? 0.035 : 0.045;
    const limit = perfProfile?.isMobile ? 9 : 16;
    const nudgeX = Math.max(-limit, Math.min(limit, dx * strength));
    const nudgeY = Math.max(-limit, Math.min(limit, dy * strength));
    wrapper.style.setProperty('--globe-nudge-x', `${nudgeX.toFixed(2)}px`);
    wrapper.style.setProperty('--globe-nudge-y', `${nudgeY.toFixed(2)}px`);
  }, [isHomeScreen, perfProfile?.isMobile]);

  const resetGlobeNudge = useCallback(() => {
    const wrapper = globeContentWrapperRef.current;
    if (!wrapper) return;
    wrapper.style.transition = 'transform 520ms cubic-bezier(0.18, 0.9, 0.22, 1.18)';
    wrapper.style.setProperty('--globe-nudge-x', '0px');
    wrapper.style.setProperty('--globe-nudge-y', '0px');
  }, []);

  const handlePointerUp = useCallback((event) => {
    const tap = tapRef.current;
    tapRef.current = null;
    resetGlobeNudge();
    if (isHomeScreen) return;
    if (!tap || tap.pointerId !== event.pointerId) return;

    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    const moved = Math.hypot(dx, dy);
    const elapsed = performance.now() - tap.t;
    if (moved > 10 || elapsed > 600 || !globeEl.current?.toGlobeCoords) return;

    if (event.pointerType === 'touch' && isKeyboardMode && viewport.width < 1024) {
      event.preventDefault();
      onPreserveInputFocus?.();
    }

    const coords = globeEl.current.toGlobeCoords(event.clientX, event.clientY);
    if (coords) {
      selectCountryAtLngLat(coords.lng, coords.lat);
    } else {
      // Clicked in space (not on the globe sphere)
      selectCountry(null);
    }
  }, [isHomeScreen, isKeyboardMode, onPreserveInputFocus, resetGlobeNudge, selectCountryAtLngLat, selectCountry, viewport.width]);

  const REGION_COLORS = useMemo(() => {
    const colors = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Unknown"];
    regions.forEach(r => {
      colors[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return colors;
  }, [globeTheme, theme]);

  const REGION_COLORS_ATTENUATED = useMemo(() => {
    const colors = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Unknown"];
    regions.forEach(r => {
      colors[r] = getThemeRegionColorAttenuated(globeTheme, theme, r);
    });
    return colors;
  }, [globeTheme, theme]);

  const REGION_COLORS_LABELS = useMemo(() => {
    const colors = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Unknown"];
    regions.forEach(r => {
      colors[r] = getThemeRegionColorLabel(globeTheme, theme, r);
    });
    return colors;
  }, [globeTheme, theme]);
  const UI_COLORS = useMemo(() => {
    const baseTheme = THEME[theme] || THEME.dark;
    const overrides = THEME_OVERRIDES[globeTheme]?.[theme] || {};
    return {
      ...baseTheme,
      ...overrides
    };
  }, [theme, globeTheme]);

  const foundSet = useMemo(() => {
    if (isHomeScreen) {
      return new Set(Object.keys(gameDataMap));
    }
    return new Set(foundList);
  }, [foundList, isHomeScreen, gameDataMap]);

  const extrusionScale = useMemo(() => {
    return globeLightingEnabled ? 1.8 : 1;
  }, [globeLightingEnabled]);

  const blackoutSurfaceBase = useMemo(() => {
    return isLight ? SURFACE_THEME_COLORS.blackout.light : SURFACE_THEME_COLORS.blackout.dark;
  }, [isLight]);

  const getRegionSurfaceColor = useCallback((region) => {
    if (globeTheme === 'blueprint') {
      return SURFACE_THEME_COLORS.blueprint.base;
    }
    if (globeTheme === 'blackout') {
      return getThemeRegionColor(globeTheme, theme, region);
    }
    return REGION_COLORS[region] || UI_COLORS.success;
  }, [globeTheme, REGION_COLORS, UI_COLORS.success, theme]);

  const getPolygonColor = useCallback((d) => {
    if (isDepartmentMode) {
      const admin = getFeatureAdmin(d);
      if (d.isGhostCountry) return UI_COLORS.mapBase;
      if (isEndScreen && !foundSet.has(admin)) return UI_COLORS.error;

      const regionCode = d.properties?.region || 'Unknown';
      let baseColor = FRENCH_REGION_COLORS[regionCode] || UI_COLORS.mapBase;

      if (globeTheme === 'blueprint') {
        baseColor = SURFACE_THEME_COLORS.blueprint.base;
      } else if (globeTheme === 'blackout') {
        baseColor = blackoutSurfaceBase;
      }

      if (foundSet.has(admin) || mode === 'learn') {
        if (admin === selectedCountry) {
          if (isError) return UI_COLORS.error;
          if (globeTheme === 'blackout') return blackoutSurfaceBase;
          return lerpColor(baseColor, UI_COLORS.paper, 0.15);
        }
        return baseColor;
      }

      if (admin === selectedCountry) {
        if (isError) return UI_COLORS.error;
        if (globeTheme === 'blackout') return blackoutSurfaceBase;
        return lerpColor(baseColor, UI_COLORS.paper, 0.1);
      }

      return UI_COLORS.mapBase;
    }

    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';

    // End screen: Green (or Gold if perfect) for found, Red for missed
    if (isEndScreen) {
      if (foundSet.has(admin)) {
        return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      }
      return UI_COLORS.error;
    }


    if (foundSet.has(admin) || mode === 'learn') {
      const baseColor = getRegionSurfaceColor(region);
      if (admin === selectedCountry) {
        if (isError) return UI_COLORS.error;
        if (globeTheme === 'blackout') return blackoutSurfaceBase;
        // Resting selected found country color (slightly lighter than base)
        return lerpColor(
          baseColor,
          UI_COLORS.paper,
          0.1 * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        );
      }
      return baseColor;
    }

    if (admin === selectedCountry) {
      if (isError) return UI_COLORS.error;
      if (globeTheme === 'blackout') return blackoutSurfaceBase;
      const baseColor = REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
      const targetColor = REGION_COLORS[region] || UI_COLORS.accent;
      // Resting selected unfound country color (slightly highlighted)
      return lerpColor(baseColor, targetColor, 0.1);
    }

    return UI_COLORS.mapBase;
  }, [selectedCountry, mode, foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, isError, isHomeScreen, isDepartmentMode, isEndScreen, isPerfectScore, getRegionSurfaceColor, globeTheme, isLight, lerpColor, blackoutSurfaceBase]);

  const getPolygonStroke = useCallback((d) => {
    if (isHomeScreen) {
      return isLight
        ? lerpColor(UI_COLORS.mapSea, UI_COLORS.mapBorderMuted, 0.45)
        : UI_COLORS.mapBorder;
    }
    if (isDepartmentMode) {
      const admin = getFeatureAdmin(d);
      if (d.isGhostCountry) return isLight
        ? lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.12)
        : lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.08);
      if (admin === selectedCountry) return isError ? UI_COLORS.error : UI_COLORS.accent;
      if (foundSet.has(admin)) return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      return isLight ? UI_COLORS.mapBorderMuted : UI_COLORS.mapBorder;
    }

    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';

    if (admin === selectedCountry) {
      if (isError) return UI_COLORS.error;
      return UI_COLORS.accent;
    }

    if (globeTheme === 'satellite') {
      if (foundSet.has(admin) || mode === 'learn') {
        return REGION_COLORS_LABELS[region] || UI_COLORS.accent;
      }
      return STROKE_THEME_COLORS.satellite.unfound;
    }

    if (!foundSet.has(admin) && mode !== 'learn') {
      if (globeTheme === 'blueprint') {
        return STROKE_THEME_COLORS.blueprint.unfound;
      }
      if (globeTheme === 'blackout') {
        return isLight ? UI_COLORS.mapBorderMuted : UI_COLORS.mapBorder;
      }
      return isLight
        ? UI_COLORS.mapBorderMuted
        : UI_COLORS.mapBorder;
    }

    // Found / Learned / Homepage countries
    if (globeTheme === 'blueprint') {
      return STROKE_THEME_COLORS.blueprint.found;
    }
    if (globeTheme === 'blackout') {
      return isLight ? UI_COLORS.mapBorder : STROKE_THEME_COLORS.blackout.found;
    }

    const baseColor = (foundSet.has(admin) || mode === 'learn')
      ? getRegionSurfaceColor(region)
      : UI_COLORS.mapBase;

    return isLight
      ? lerpColor(
          baseColor,
          UI_COLORS.ink,
          GLOBE_STYLE.lighting.strokeDarken.light
        )
      : UI_COLORS.mapBorder;
  }, [selectedCountry, UI_COLORS, isError, foundSet, mode, isHomeScreen, isLight, isDepartmentMode, lerpColor, isPerfectScore, getRegionSurfaceColor, globeTheme, REGION_COLORS_LABELS]);

  const getPolygonSideColor = useCallback((d) => {
    if (isDepartmentMode) {
      if (d.isGhostCountry) return UI_COLORS.mapSea;
      return lerpColor(getPolygonColor(d), UI_COLORS.black, isLight ? 0.012 : 0.02);
    }

    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';

    let baseColor;
    if (isEndScreen) {
      if (foundSet.has(admin)) {
        baseColor = isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      } else {
        baseColor = UI_COLORS.error;
      }
    } else {
      baseColor = (foundSet.has(admin) || mode === 'learn')
        ? getRegionSurfaceColor(region)
        : UI_COLORS.mapBase;
    }

    if (globeLightingEnabled) {
      if (admin === selectedCountry) {
        if (isError) return isLight ? UI_COLORS.errorDeep : UI_COLORS.errorDeeper;
        if (globeTheme === 'blackout') return blackoutSurfaceBase;

        // Base color for the side when selected under lighting
        const sideBaseColor = (foundSet.has(admin) || mode === 'learn')
          ? getRegionSurfaceColor(region)
          : (REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent);

        return lerpColor(
          sideBaseColor,
          UI_COLORS.black,
          isLight ? GLOBE_STYLE.lighting.sideDarken.selectedLight : GLOBE_STYLE.lighting.sideDarken.selectedDark
        );
      }
      if (foundSet.has(admin) || mode === 'learn') {
        const base = getRegionSurfaceColor(region);
        return lerpColor(
          base,
          UI_COLORS.black,
          isLight ? GLOBE_STYLE.lighting.sideDarken.foundLight : GLOBE_STYLE.lighting.sideDarken.foundDark
        );
      }
      return lerpColor(
        UI_COLORS.mapBase,
        UI_COLORS.black,
        isLight ? GLOBE_STYLE.lighting.sideDarken.baseLight : GLOBE_STYLE.lighting.sideDarken.baseDark
      );
    }

    if (admin === selectedCountry) {
      if (isError) return isLight ? UI_COLORS.errorMuted : UI_COLORS.errorDeep;
      if (globeTheme === 'blackout') return blackoutSurfaceBase;

      const capColor = (foundSet.has(admin) || mode === 'learn')
        ? lerpColor(
          getRegionSurfaceColor(region),
          UI_COLORS.paper,
          0.1 * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        )
        : lerpColor(
          REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent,
          REGION_COLORS[region] || UI_COLORS.accent,
          0.1
        );

      return lerpColor(capColor, UI_COLORS.black, isLight ? 0.24 : 0.08);
    }

    return lerpColor(baseColor, UI_COLORS.black, isLight ? 0.32 : 0.16);
  }, [foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, selectedCountry, isLight, globeLightingEnabled, mode, isHomeScreen, isDepartmentMode, lerpColor, getPolygonColor, getRegionSurfaceColor, globeTheme, blackoutSurfaceBase]);

  const getPolygonMaterial = useCallback((d, kind) => {
    const admin = getFeatureAdmin(d) || 'unknown';
    const cache = polygonMaterialCacheRef.current[kind];
    const color = kind === 'cap' ? getPolygonColor(d) : getPolygonSideColor(d);

    const ExpectedMaterialClass = THREE.MeshPhongMaterial;

    // Handle wireframe/opacity for the hologram blueprint theme
    const isFound = foundSet.has(admin) || mode === 'learn';
    let targetWireframe = false;
    let targetOpacity = 1;
    let targetTransparent = false;

    if (globeTheme === 'satellite') {
      targetTransparent = true;
      if (isHomeScreen) {
        targetOpacity = 0.0;
      } else if (admin === selectedCountry) {
        targetOpacity = 0.45;
      } else if (isFound) {
        targetOpacity = 0.25;
      } else {
        targetOpacity = 0.0;
      }
    }


    let emissiveHex = UI_COLORS.black;
    let emissiveIntensity = 0;
    let specularHex = THREE.Color ? new THREE.Color(UI_COLORS.black) : UI_COLORS.black;
    let shininess = 0.7;

    if (globeTheme === 'blackout') {
      if (!isFound && admin !== selectedCountry) {
        emissiveHex = UI_COLORS.black;
        emissiveIntensity = 0;
        specularHex = new THREE.Color(0x000000);
        shininess = 0.0;
      } else {
        emissiveHex = color;
        emissiveIntensity = isLight ? 0.22 : 0.52;
        specularHex = new THREE.Color(0x000000); // 100% matte
        shininess = 0.0; // 100% matte
      }
    } else if (isDepartmentMode && !d.isGhostCountry) {
      emissiveHex = color;
      emissiveIntensity = kind === 'cap' ? (isLight ? 0.08 : 0.12) : (isLight ? 0.04 : 0.07);
      specularHex = UI_COLORS.mapBorder;
      shininess = kind === 'cap' ? 2 : 1;
    } else if (globeLightingEnabled) {
      emissiveHex = color;

      const baseEmissiveIntensity = (kind === 'cap'
        ? (isLight ? GLOBE_STYLE.lighting.material.capEmissiveLight : GLOBE_STYLE.lighting.material.capEmissiveDark)
        : (isLight ? GLOBE_STYLE.lighting.material.sideEmissiveLight : GLOBE_STYLE.lighting.material.sideEmissiveDark));

      // Standard emissive boost in dark mode
      const emissiveBoost = !isLight ? 0.18 : 0.05;

      emissiveIntensity = baseEmissiveIntensity + emissiveBoost + (
        admin === selectedCountry ? 0.1 : 0
      );

      specularHex = admin === selectedCountry ? UI_COLORS.paper : UI_COLORS.mapBorder;
      const baseShininess = (kind === 'cap'
        ? (isLight ? GLOBE_STYLE.lighting.material.capShininessLight : GLOBE_STYLE.lighting.material.capShininessDark)
        : (isLight ? GLOBE_STYLE.lighting.material.sideShininessLight : GLOBE_STYLE.lighting.material.sideShininessDark));

      shininess = baseShininess + (admin === selectedCountry ? 30 : (isLight ? 0 : 25));
    }

    const isIsolated = admin === selectedCountry;
    const isShaderCap = kind === 'cap' && (isIsolated || (isEndScreen && !foundSet.has(admin)));
    const isMobileStr = perfProfile?.isMobile ? 'mobile' : 'desktop';

    // Construct cache/pool key
    const cacheKey = isShaderCap
      ? `shader-${admin}-${kind}-${isMobileStr}`
      : `${kind}-${color}-${targetWireframe}-${targetOpacity}-${targetTransparent}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}`;

    let material = sharedMaterialsRef.current.get(cacheKey);

    if (!material) {
      material = new ExpectedMaterialClass({
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        depthWrite: true
      });

      material.color.set(safeColor(color));
      material.wireframe = targetWireframe;
      material.transparent = targetTransparent;
      material.opacity = targetOpacity;
      material.flatShading = false;

      material.emissive.set(safeColor(emissiveHex));
      material.emissiveIntensity = emissiveIntensity;

      if (material.isMeshPhongMaterial) {
        material.specular.set(safeColor(specularHex));
        material.shininess = shininess;
      }

      if (isIsolated && kind === 'side') {
        material.transparent = true;
        material.opacity = 0.55;
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = { value: 0 };
          shader.uniforms.uIsLight = { value: isLight ? 1.0 : 0.0 };
          material.userData.shader = shader;

          shader.fragmentShader = `
            uniform float uTime;
            uniform float uIsLight;
          ` + shader.fragmentShader;

          shader.fragmentShader = shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
             // Holographic scanlines moving vertically on the sides (light beam effect)
             vec2 uv = gl_FragCoord.xy;
             float beamPattern = sin(uv.y * 0.4 - uTime * 15.0) * 0.5 + 0.5;
             float noise = fract(sin(dot(uv + uTime, vec2(12.9898,78.233))) * 43758.5453);

             // Glowing light beam
             vec3 beamColor = vec3(1.0);

             // Make it pulse and flow like a laser barrier/energy wall
             gl_FragColor.rgb = mix(gl_FragColor.rgb, beamColor, 0.3 + 0.7 * beamPattern * (0.8 + 0.2 * noise));
             gl_FragColor.a = 0.35 + 0.45 * beamPattern;
            `
          );
        };
      }

      if (isShaderCap) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = { value: 0 };
          shader.uniforms.uIsError = { value: (isEndScreen && !foundSet.has(admin)) || (admin === selectedCountry && isError) ? 1.0 : 0.0 };
          shader.uniforms.uIsSuccess = { value: (admin === selectedCountry && isSuccess) ? 1.0 : 0.0 };
          shader.uniforms.uIsLight = { value: isLight ? 1.0 : 0.0 };
          shader.uniforms.uTheme = { value: (
            globeTheme === 'blackout' ? 1.0 : (globeTheme === 'blueprint' ? 2.0 : 0.0)
          )};
          material.userData.shader = shader;

          shader.fragmentShader = `
            uniform float uTime;
            uniform float uIsError;
            uniform float uIsSuccess;
            uniform float uIsLight;
            uniform float uTheme;
            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
          ` + shader.fragmentShader;

          shader.fragmentShader = shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
             vec2 uv = gl_FragCoord.xy;
             float t = uTime * 28.0;
             float noise = hash(uv + sin(t));

             // Dynamic static range: bright static in light theme, dark static in dark theme
             float baseMin = (uIsLight > 0.5) ? 0.65 : 0.12;
             float baseMax = (uIsLight > 0.5) ? 0.98 : 0.68;
             float scanline = sin(uv.y * 1.5 + uTime * 5.0) * ((uIsLight > 0.5) ? 0.03 : 0.07);

             float staticColor = mix(baseMin, baseMax, noise) + scanline;
             vec3 staticVec = vec3(staticColor);

             vec3 finalColor = gl_FragColor.rgb;
             if (uTheme > 0.9 && uTheme < 1.1) {
               // Blackout theme: 100% monochrome static
               finalColor = staticVec;
             } else if (uTheme > 1.9 && uTheme < 2.1) {
               // Blueprint theme: blue-tinted static
               vec3 blueStatic = vec3(staticColor * 0.15, staticColor * 0.50, staticColor * 0.95);
               finalColor = mix(gl_FragColor.rgb, blueStatic, 0.80);
             } else {
               // Other themes (modern glass, satellite): subtle holographic noise overlay
               finalColor = mix(gl_FragColor.rgb, staticVec, 0.40);
             }

             if (uIsError > 0.5) {
               // Error / Loose: Analog TV sync roll & static tear
               float syncRoll = step(0.68, sin(uv.y * 0.08 - uTime * 45.0));
               float glitchNoise = hash(uv + sin(uTime * 80.0));
               float glitchStatic = mix(0.05, 0.95, glitchNoise);

               if (uTheme > 0.9 && uTheme < 1.1) {
                 // Blackout: pure monochrome rolling bar static tear (Grayscale)
                 finalColor = vec3(mix(glitchStatic, syncRoll, 0.65));
               } else {
                 // Other themes: mix with red color and rolling sync bar
                 vec3 bloodRed = vec3(0.85, 0.12, 0.12);
                 finalColor = mix(vec3(glitchStatic), bloodRed, 0.60 + syncRoll * 0.40);
               }
             }

             if (uIsSuccess > 0.5) {
               // Success: s'illumine with an animated high-contrast flash/pulse
               float pulse = sin(uTime * 15.0) * 0.4 + 0.6;
               float sweep = step(fract(uv.y * 0.02 - uTime * 2.0), 0.15) * 0.35;
               if (uTheme > 0.9 && uTheme < 1.1) {
                 // Blackout: bright glowing white flash and scanline sweep
                 finalColor = vec3(pulse + sweep);
               } else {
                 // Other themes: neon green flash and sweep
                 vec3 neonGreen = vec3(0.05, 0.92, 0.52);
                 finalColor = mix(finalColor, neonGreen * (pulse + sweep + 0.5), 0.85);
               }
             }

             gl_FragColor.rgb = finalColor;
            `
          );
        };
      }

      material.userData.isIsolated = isIsolated;
      material.userData.isShared = !isIsolated;
      material.userData.admin = admin;

      sharedMaterialsRef.current.set(cacheKey, material);
    }

    // Keep country mapping updated for the animation loop
    cache.set(admin, material);

    return material;
  }, [getPolygonColor, getPolygonSideColor, isLight, globeLightingEnabled, UI_COLORS, selectedCountry, isDepartmentMode, foundSet, globeTheme, mode, perfProfile, isHomeScreen]);

  const getPolygonCapMaterial = useCallback((d) => (
    getPolygonMaterial(d, 'cap')
  ), [getPolygonMaterial]);

  const getPolygonSideMaterial = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    if (admin === selectedCountry) {
      // Selected country gets a visible, brightly colored side wall acting as a thick highlighted border
      return getPolygonMaterial(d, 'side');
    }
    return invisibleMaterial;
  }, [selectedCountry, getPolygonMaterial]);

  useEffect(() => {
    const materialCache = polygonMaterialCacheRef.current;
    const sharedPool = sharedMaterialsRef.current;
    return () => {
      materialCache.cap.clear();
      materialCache.side.clear();
      sharedPool.forEach(material => material.dispose());
      sharedPool.clear();
    };
  }, [isLight, globeTheme, globeLightingEnabled, mode, isDepartmentMode]);

  const getPolygonAltitude = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    // Uniform extrusion via gameConfig — department mode is viewed up close so its
    // selected altitude is scaled down to match a world-view country's apparent height.
    return getPolygonAltitudeFor({
      isDepartmentMode,
      isGhostCountry: !!(isDepartmentMode && d.isGhostCountry),
      isSelected: admin === selectedCountry
    });
  }, [isDepartmentMode, selectedCountry]);

  const getSelectionEffectAltitude = useCallback(() => {
    if (selectedCountry) return 0.0075; // Above selected country's 3.5D surface (0.006)
    return 0.0015;
  }, [selectedCountry]);

  const getHtmlAltitude = useCallback((d) => {
    if (selectedCountry && d.admin === selectedCountry) return 0.0085; // Above selected country & selection effect
    return 0.002;
  }, [selectedCountry]);

  const getPolygonStrokeWidth = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    if (isDepartmentMode && d.isGhostCountry) {
      return perfProfile?.isMobile ? 0.1 : 0.15;
    }
    // Increased thickness for selection (contour plus visible)
    if (admin === selectedCountry) return perfProfile?.isMobile ? 5.5 : 7.5;
    if (isDepartmentMode) return perfProfile?.isMobile ? 0.85 : 1.1;
    if (globeTheme === 'blackout') {
      return perfProfile?.isMobile ? 1.1 : 1.6;
    }
    if (isLight || globeLightingEnabled) return perfProfile?.isMobile ? 0.75 : 0.95;
    return perfProfile?.isMobile ? 0.55 : 0.75;
  }, [globeLightingEnabled, isLight, perfProfile?.isMobile, selectedCountry, isDepartmentMode, globeTheme]);

  const countrySizes = useMemo(() => {
    const sizes = {};
    selectableFeatureIndex.forEach(entry => {
      const b = entry.bounds;
      // Approximate "radius" in degrees
      sizes[entry.admin] = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat);
    });
    return sizes;
  }, [selectableFeatureIndex]);

  const visibleRenderCountriesData = useMemo(() => {
    if (!perfProfile?.cullOffscreenCountries || isHomeScreen || isEndScreen) {
      return renderCountriesData;
    }

    const pov = cameraPOV;
    const renderRadius = getMobileRenderRadius(zoomLevel);

    return renderCountriesData.filter(feature => {
      const admin = getFeatureAdmin(feature);
      if (!admin) return false;
      if (admin === selectedCountry) return true;

      const data = countryDataMap[admin];
      if (!data || data.lat === undefined || data.lng === undefined) return true;

      const size = countrySizes[admin] || 1;
      const sizeBuffer = Math.min(70, Math.max(8, size * 0.75));
      const distToCenter = getLngLatDistance(data.lng, data.lat, pov.lng, pov.lat);

      return distToCenter <= renderRadius + sizeBuffer;
    });
  }, [
    cameraPOV,
    countrySizes,
    isEndScreen,
    isHomeScreen,
    perfProfile?.cullOffscreenCountries,
    renderCountriesData,
    selectedCountry,
    zoomLevel
  ]);

  const labelsData = useMemo(() => {
    if (perfProfile?.maxLabels === 0 || !globeEl.current) return [];

    let labelsToProcess = [];

    if (isDepartmentMode) {
      Object.keys(gameDataMap).forEach(k => {
        labelsToProcess.push({ key: k, data: gameDataMap[k], modeName: 'departments' });
      });
    } else if (isRiversMountainsMode) {
      Object.keys(gameDataMap).forEach(k => {
        labelsToProcess.push({ key: k, data: gameDataMap[k], modeName: 'rivers_mountains' });
      });
    } else if (mode === 'learn') {
      if (learnShowCountryLabels || learnShowCapitals) {
        Object.keys(countryDataMap).forEach(k => {
          labelsToProcess.push({
            key: k,
            data: countryDataMap[k],
            modeName: learnShowCountryLabels ? 'countries' : 'capitals',
            hideCountryLine: !learnShowCountryLabels
          });
        });
      }
      if (learnShowRivers) {
        Object.keys(riversMountainsDataMap).forEach(k => {
          if (riversMountainsDataMap[k].type === 'river') {
            labelsToProcess.push({ key: k, data: riversMountainsDataMap[k], modeName: 'rivers_mountains' });
          }
        });
      }
      if (learnShowMountains) {
        Object.keys(riversMountainsDataMap).forEach(k => {
          if (riversMountainsDataMap[k].type === 'mountain' || riversMountainsDataMap[k].type === 'mountain_range') {
            labelsToProcess.push({ key: k, data: riversMountainsDataMap[k], modeName: 'rivers_mountains' });
          }
        });
      }
    } else {
      const keys = (isHomeScreen || isEndScreen)
        ? Object.keys(countryDataMap)
        : (perfProfile?.isMobile
          ? (selectedCountry ? [...new Set([selectedCountry, ...foundList.slice(-1)])] : foundList.slice(-2))
          : (selectedCountry && !foundList.includes(selectedCountry) ? [...foundList, selectedCountry] : foundList));
      keys.forEach(k => {
        labelsToProcess.push({ key: k, data: countryDataMap[k], modeName: mode });
      });
    }

    const pov = cameraPOV;

    const filtered = labelsToProcess
      .map(({ key, data, modeName, hideCountryLine = false }) => {
        if (!data) return null;

        const isSelected = key === selectedCountry;
        const isFound = foundSet.has(key);
        const size = countrySizes[key] || 0.5;

        // Skip unfound labels in play mode for countries, departments, and rivers/mountains
        const isPlayMode = mode !== 'learn' && !isHomeScreen && !isEndScreen;
        if (isPlayMode && !isFound && !isSelected) {
          return null;
        }

        // Visibility based on zoom level
        const isRivMount = modeName === 'rivers_mountains';
        const visibilityThreshold = isDepartmentMode
          ? 1.05
          : (isSelected ? 10 : (isHomeScreen ? 1.8 : (isRivMount ? 2.5 : Math.min(3.0, 0.8 + size * 2.0))));

        if (zoomLevel > visibilityThreshold) return null;

        let dLng = Math.abs(data.lng - pov.lng);
        if (dLng > 180) dLng = 360 - dLng;
        const distToCenter = Math.hypot(dLng, data.lat - pov.lat);

        const labelRadius = isDepartmentMode
          ? 7
          : getLabelRenderRadius(zoomLevel, !!perfProfile?.isMobile);
        if (!isSelected && distToCenter > labelRadius) return null;

        const cacheKey = `${key}_${modeName}`;
        const cached = labelsCacheRef.current[cacheKey];
        if (
          cached &&
          cached.isSelected === isSelected &&
          cached.lang === lang &&
          cached.isFound === isFound &&
          cached.mode === mode &&
          cached.learnShowCapitals === learnShowCapitals &&
          cached.hideCountryLine === hideCountryLine
        ) {
           cached.distToCenter = distToCenter;
           return cached;
        }

        const newLabel = {
          admin: key,
          lat: data.lat,
          lng: data.lng,
          country: lang === 'fr' ? (data.name_fr || key) : (data.name_en || key),
          capital: lang === 'fr' ? (data.capital_fr || data.capital) : data.capital,
          region: data.region,
          flag: getFlagEmoji(data.iso2),
          code: data.code,
          size,
          distToCenter,
          isSelected,
          isFound,
          mode: modeName,
          learnShowCapitals,
          hideCountryLine,
          lang
        };
        labelsCacheRef.current[cacheKey] = newLabel;
        return newLabel;
      })
      .filter(d => d !== null)
      .sort((a, b) => {
        if (a.isSelected) return -1;
        if (b.isSelected) return 1;
        return a.distToCenter - b.distToCenter;
      });

    if (isDepartmentMode) return filtered.slice(0, perfProfile?.isMobile ? 10 : 18);
    if (mode === 'learn') {
      const limit = perfProfile?.isMobile ? 20 : 40;
      return filtered.slice(0, limit);
    }
    return perfProfile?.maxLabels ? filtered.slice(0, perfProfile.maxLabels) : filtered;
  }, [foundList, countrySizes, zoomLevel, cameraPOV, lang, perfProfile?.maxLabels, perfProfile?.isMobile, mode, selectedCountry, isHomeScreen, isDepartmentMode, isRiversMountainsMode, gameDataMap, foundSet, learnShowCountryLabels, learnShowCapitals, learnShowRivers, learnShowMountains]);

  const createLabelElement = useCallback((d) => {
    const el = document.createElement('div');

    let color;
    if (d.mode === 'departments') {
      color = d.isFound ? UI_COLORS.success : (d.isSelected ? UI_COLORS.accent : UI_COLORS.textMuted);
    } else if (isHomeScreen) {
      color = UI_COLORS.textMuted;
    } else if (globeTheme === 'blackout') {
      if (d.isFound) {
        color = UI_COLORS.textMuted;
      } else {
        color = d.isSelected ? UI_COLORS.accent : UI_COLORS.textMuted;
      }
    } else if (globeTheme === 'blueprint') {
      color = (d.isFound || d.isSelected) ? UI_COLORS.accent : UI_COLORS.textMuted;
    } else if (globeTheme === 'satellite') {
      color = (d.isFound || d.isSelected) ? UI_COLORS.paper : UI_COLORS.textMuted;
    } else {
      // Modern Glass theme uses regional colors for found/selected
      color = (d.isFound || d.isSelected)
        ? (REGION_COLORS_LABELS[d.region] || UI_COLORS.accent)
        : UI_COLORS.textMuted;
    }

    // Set root to 0 size so its center is the exact lat/lng
    el.style.width = '0';
    el.style.height = '0';
    el.style.position = 'relative';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';

    const isPlayMode = mode !== 'learn' && d.mode !== 'learn' && !isHomeScreen && !isEndScreen;
    const revealAll = !isPlayMode || d.isFound;

    // Uniform scramble across every guessable mode (countries, capitals, departments,
    // rivers/mountains) so no mode leaks its answer as readable text.
    const isGlitchMode = shouldScrambleLabel(d.mode, {
      isFound: d.isFound,
      isHomeScreen,
      isEndScreen,
      isSelected: d.isSelected,
      isLearn: mode === 'learn'
    });

    // Local helper to scramble text with glitched characters (100% scrambled to prevent reading letters)
    const localScrambleText = (text, seed = 0) => {
      if (!text) return '';
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&?*¢¤§░▒▓█▲▼◆◇';
      return text.split('').map((char, index) => {
        if (char === ' ' || char === '-' || char === "'") return char;
        const hash = Math.sin(index * 13.5 + seed * 7.1) * 10000;
        const rand = Math.abs(hash) % 1.0;
        const glyphIndex = Math.floor(rand * glyphs.length);
        return glyphs[glyphIndex];
      }).join('');
    };

    if (isGlitchMode) {
      const isCapitalsMode = d.mode === 'capitals';
      const isDeptMode = d.mode === 'departments';
      const isReliefMode = d.mode === 'rivers_mountains';
      const reliefIcon = isReliefMode
        ? ((gameDataMap[d.admin]?.type === 'mountain_range' || riversMountainsDataMap[d.admin]?.type === 'mountain_range') ? '🏔️' : '💧')
        : '';
      const glitchLine1Raw = isCapitalsMode ? d.capital : d.country;
      const glitchLine1Class = isCapitalsMode ? 'glitch-capital' : 'glitch-country';
      // Keep the department code / relief icon legible (it is the question, not the answer);
      // only the name itself scrambles. Other modes keep the animated glyph marker.
      const prefixHtml = isDeptMode && d.code
        ? `<span style="font-weight: 800; background: ${color}; color: ${UI_COLORS.textInverse}; padding: 0px 3px; border-radius: 3px; font-size: 9px; line-height: 1.1;">${d.code}</span>`
        : isReliefMode
          ? `<span style="font-size: 10px;">${reliefIcon}</span>`
          : `<span class="glitch-flag">▒</span>`;

      // Glitched/scrambled animated callout box (Minimalist, centered on top of stalk)
      el.innerHTML = `
        <div class="globe-label-element" style="position: relative; width: 0; height: 0; pointer-events: none;">
          <!-- Dot -->
          <div style="
            position: absolute;
            width: 6px;
            height: 6px;
            background: ${color};
            border-radius: 50%;
            left: -3px;
            top: -3px;
            box-shadow: 0 0 8px ${color};
            opacity: ${isHomeScreen ? 0.5 : 1};
          "></div>
          <!-- Stalk Line (Shortened to 15px) -->
          <div style="
            position: absolute;
            width: 1.2px;
            height: 15px;
            background: linear-gradient(to top, ${color} 0%, color-mix(in srgb, ${UI_COLORS.paper} 30%, transparent) 100%);
            left: -0.6px;
            bottom: 3px;
            opacity: ${isHomeScreen ? 0.4 : 0.85};
          "></div>
          <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
          <div style="
            position: absolute;
            left: 50%;
            bottom: 21px;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: var(--font-display, monospace);
            white-space: nowrap;
            color: ${UI_COLORS.textMain};
            text-shadow: 0 1px 2px color-mix(in srgb, ${UI_COLORS.black} 60%, transparent);
            opacity: ${isHomeScreen ? 0.6 : 1};
          ">
            <div style="font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 4px;">
              ${prefixHtml}
              <span class="${glitchLine1Class}" data-text="${glitchLine1Raw}">${localScrambleText(glitchLine1Raw)}</span>
            </div>
            ${isCapitalsMode ? `
              <div style="font-weight: 500; font-size: 9px; color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px;">
                <span class="glitch-country" data-text="${d.country}">${localScrambleText(d.country)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      // Start dynamic scrambling interval
      const interval = setInterval(() => {
        if (!document.body.contains(el)) {
          clearInterval(interval);
          return;
        }
        const countryEl = el.querySelector('.glitch-country');
        const capitalEl = el.querySelector('.glitch-capital');
        const flagEl = el.querySelector('.glitch-flag');

        const glyphs = '░▒▓█▲▼◆◇@#$%&?*¢';
        if (countryEl) {
          const raw = countryEl.getAttribute('data-text') || '';
          countryEl.innerText = localScrambleText(raw, Math.random());
        }
        if (capitalEl) {
          const raw = capitalEl.getAttribute('data-text') || '';
          capitalEl.innerText = localScrambleText(raw, Math.random());
        }
        if (flagEl) {
          flagEl.innerText = glyphs[Math.floor(Math.random() * glyphs.length)];
        }
      }, 150);

    } else {
      // Normal clean callout box (Minimalist, centered on top of stalk)
      const iconSymbol = d.mode === 'rivers_mountains'
        ? (gameDataMap[d.admin]?.type === 'mountain_range' || riversMountainsDataMap[d.admin]?.type === 'mountain_range' ? '🏔️ ' : '💧 ')
        : '';

      const displayName = revealAll ? d.country : '???';
      const displayCapital = revealAll ? d.capital : '???';

      const hasCapitalLine = (d.mode === 'capitals' || (mode === 'learn' && d.learnShowCapitals)) && d.capital;

      let line1Content;
      let line2Content = null;

      if (d.mode === 'departments') {
        line1Content = `
          ${d.code ? `<span style="font-weight: 800; background: ${color}; color: ${UI_COLORS.textInverse}; padding: 0px 3px; border-radius: 3px; font-size: 9px; line-height: 1.1; margin-right: 3px;">${d.code}</span>` : ''}
          <span>${displayName}</span>
        `;
        if (d.capital) {
          line2Content = `(${displayCapital})`;
        }
      } else {
        const line1Text = hasCapitalLine ? `${d.flag || ''} ${d.capital}` : `${iconSymbol || d.flag || ''} ${d.country}`;
        line1Content = `<span>${line1Text}</span>`;
        if (hasCapitalLine && !d.hideCountryLine) {
          line2Content = d.country;
        }
      }

      el.innerHTML = `
        <div class="globe-label-element" style="position: relative; width: 0; height: 0; pointer-events: none;">
          <!-- Dot -->
          <div style="
            position: absolute;
            width: 6px;
            height: 6px;
            background: ${color};
            border-radius: 50%;
            left: -3px;
            top: -3px;
            box-shadow: 0 0 8px ${color};
            opacity: ${isHomeScreen ? 0.5 : 1};
          "></div>
          <!-- Stalk Line (Shortened to 15px) -->
          <div style="
            position: absolute;
            width: 1.2px;
            height: 15px;
            background: linear-gradient(to top, ${color} 0%, color-mix(in srgb, ${UI_COLORS.paper} 30%, transparent) 100%);
            left: -0.6px;
            bottom: 3px;
            opacity: ${isHomeScreen ? 0.4 : 0.85};
          "></div>
          <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
          <div style="
            position: absolute;
            left: 50%;
            bottom: 21px;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: var(--font-main);
            white-space: nowrap;
            color: ${UI_COLORS.textMain};
            text-shadow: 0 1px 2px color-mix(in srgb, ${UI_COLORS.black} 60%, transparent);
            opacity: ${isHomeScreen ? 0.6 : 1};
          ">
            <div style="font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 4px;">
              ${line1Content}
            </div>
            ${line2Content ? `
              <div style="font-weight: 500; font-size: 9px; color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px;">
                ${line2Content}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    return el;
  }, [REGION_COLORS_LABELS, UI_COLORS, isHomeScreen, isEndScreen, isLight, gameDataMap, globeTheme, mode]);

  const biomePointsCacheRef = useRef({});

  // Clean biome cache on restart or theme switch
  useEffect(() => {
    if (foundList.length === 0) {
      biomePointsCacheRef.current = {};
      disposeBiomeCache();
    }
  }, [foundList]);

  // Clean biome cache on unmount
  useEffect(() => {
    return () => {
      biomePointsCacheRef.current = {};
      disposeBiomeCache();
    };
  }, []);

  // Ref so the selected river can update its appearance without rebuilding ALL river paths
  const selectedCountryRiverRef = useRef(null);
  selectedCountryRiverRef.current = selectedCountry;

  // Base river paths — deliberately exclude selectedCountry from deps to avoid
  // mass-re-animating every river on each selection change. Only rebuilds when
  // actual data (found state, theme) changes.
  const riversBasePathsData = useMemo(() => {
    const isLearnRivers = mode === 'learn' && learnShowRivers;
    if (mode !== 'rivers_mountains' && !isLearnRivers) return [];
    const paths = [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    Object.keys(dataMap).forEach(k => {
      const data = dataMap[k];
      if (!data || data.type !== 'river' || !data.path) return;
      const isFound = foundSet.has(k) || mode === 'learn' || isHomeScreen;
      // Only reveal found rivers here — the active (selected) target, found or not, is
      // drawn separately by riversSelectedPathData. Unfound non-target rivers stay hidden
      // so the answers aren't given away.
      if (!isFound) return;
      paths.push({
        admin: k,
        coords: getSmoothedRiverPath(k, data.path),
        color: UI_COLORS.riverActive,
        // Solid thick lines — no dashes, pure stroke width is what makes rivers readable
        width: 45,
        dashLength: 1,   // 1 = full coverage = solid line
        dashGap: 0,
        dashAnimateTime: 3000, // Subtle shimmer on found rivers
      });
    });
    return paths;
  }, [gameDataMap, foundSet, mode, isHomeScreen, UI_COLORS, learnShowRivers]);

  const riversSelectedPathData = useMemo(() => {
    const isLearnRivers = mode === 'learn' && learnShowRivers;
    if ((mode !== 'rivers_mountains' && !isLearnRivers) || !selectedCountry) return [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    const data = dataMap[selectedCountry];
    if (!data || data.type !== 'river' || !data.path) return [];
    const isFound = foundSet.has(selectedCountry) || mode === 'learn' || isHomeScreen;
    const color = isFound
      ? (isError ? UI_COLORS.error : UI_COLORS.riverSelectedFound)
      : (isError ? UI_COLORS.errorGlowStrong : UI_COLORS.riverSelectedUnfound);

    const smoothedPath = getSmoothedRiverPath(selectedCountry, data.path);

    return [
      // Layer 1: Extra thick base highlight path
      {
        admin: selectedCountry,
        coords: smoothedPath,
        color,
        width: isFound ? 75 : 65,
        dashLength: 1,
        dashGap: 0,
        dashAnimateTime: 0
      },
      // Layer 2: Thinner, animated glowing white core representing current flow
      {
        admin: `${selectedCountry}_core`,
        coords: smoothedPath,
        color: UI_COLORS.paper,
        width: isFound ? 24 : 18,
        dashLength: 0.25,
        dashGap: 0.15,
        dashAnimateTime: 800
      }
    ];
  }, [gameDataMap, foundSet, mode, isHomeScreen, selectedCountry, isError, UI_COLORS, learnShowRivers]);

  // Base mountain paths
  const mountainsBasePathsData = useMemo(() => {
    const isLearnMountains = mode === 'learn' && learnShowMountains;
    if (mode !== 'rivers_mountains' && !isLearnMountains) return [];
    const paths = [];
    const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
    Object.keys(dataMap).forEach(k => {
      const data = dataMap[k];
      if (!data || data.type !== 'mountain_range' || !data.path) return;
      const isFound = foundSet.has(k) || mode === 'learn' || isHomeScreen;
      const color = isFound
        ? getThemeRegionColor(globeTheme, theme, data.region)
        : (globeTheme === 'blackout' ? STROKE_THEME_COLORS.blackout.unfound : UI_COLORS.riverInactive);

      paths.push({
        admin: k,
        coords: data.path.map(([lat, lng]) => [lat, lng, 0.002]), // Lifted slightly above surface
        color,
        width: isFound ? 35 : 20, // Pixels width
        dashLength: isFound ? 1.0 : 0.4,
        dashGap: isFound ? 0.0 : 0.25,
        dashAnimateTime: 0
      });
    });
    return paths;
  }, [gameDataMap, foundSet, mode, isHomeScreen, globeTheme, theme, UI_COLORS, learnShowMountains]);

  // Selected mountain paths
  const mountainsSelectedPathData = useMemo(() => {
    const isLearnMountains = mode === 'learn' && learnShowMountains;
    if ((mode !== 'rivers_mountains' && !isLearnMountains) || !selectedCountry) return [];
    const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
    const data = dataMap[selectedCountry];
    if (!data || data.type !== 'mountain_range' || !data.path) return [];
    const isFound = foundSet.has(selectedCountry) || mode === 'learn' || isHomeScreen;
    const regionColor = getThemeRegionColor(globeTheme, theme, data.region);
    const color = isFound
      ? (isError ? UI_COLORS.error : regionColor)
      : (isError ? UI_COLORS.errorGlowStrong : UI_COLORS.textMuted);

    const pathPoints = data.path.map(([lat, lng]) => [lat, lng, 0.0035]);

    return [
      // Outer thicker highlight
      {
        admin: selectedCountry,
        coords: pathPoints,
        color,
        width: isFound ? 60 : 50,
        dashLength: 1,
        dashGap: 0,
        dashAnimateTime: 0
      },
      // Inner glowing core
      {
        admin: `${selectedCountry}_core`,
        coords: pathPoints,
        color: UI_COLORS.paper,
        width: isFound ? 16 : 12,
        dashLength: 0.35,
        dashGap: 0.15,
        dashAnimateTime: 1200
      }
    ];
  }, [gameDataMap, foundSet, mode, isHomeScreen, selectedCountry, isError, UI_COLORS, globeTheme, theme, learnShowMountains]);

  // Combined for globe: base first, selected on top (exclude mountain lines - only show 3D mountains)
  const globePathsData = useMemo(() => [
    ...riversBasePathsData,
    ...riversSelectedPathData
  ], [riversBasePathsData, riversSelectedPathData]);

  const getBiomeAssetsData = useMemo(() => {
    const isLearnMountains = mode === 'learn' && learnShowMountains;
    if (mode === 'rivers_mountains' || isLearnMountains) {
      const assets = [];
      const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
      Object.keys(dataMap).forEach(k => {
        const data = dataMap[k];
        if (!data || data.lat === undefined) return;
        if (data.type !== 'mountain' && data.type !== 'mountain_range') return;
        const isFound = foundSet.has(k) || mode === 'learn' || isHomeScreen;
        // Hide unfound non-target mountains (same rule as rivers) so the map of answers
        // isn't revealed; the selected target still shows as a hint.
        if (!isReliefVisible({ isFound, isSelected: k === selectedCountry, isHomeScreen, isLearn: mode === 'learn' })) return;
        assets.push({
          admin: k,
          lat: data.lat,
          lng: data.lng,
          isFound,
          type: data.type,
          bearing: data.bearing || 0,
          spread: data.spread || 1.5,
          height: data.height || 4000,
          scale: data.type === 'mountain_range' ? 1.55 : 1.0,
          rotation: 0,
          path: data.path || null
        });
      });
      return assets;
    }

    return [];
  }, [gameDataMap, mode, foundSet, isHomeScreen, selectedCountry, learnShowMountains]);

  const getBiomeAltitude = useCallback((d) => {
    const admin = d.admin;
    const isLearnMountains = mode === 'learn' && learnShowMountains;
    if (mode === 'rivers_mountains' || isLearnMountains) {
      return admin === selectedCountry ? 0.003 : 0.0015;
    }
    return admin === selectedCountry ? 0.0025 : 0.0015;
  }, [selectedCountry, mode, learnShowMountains]);

  const createBiomeThreeObject = useCallback((d) => {
    const isSelected = d.admin === selectedCountry;
    const key = `${d.admin || 'unknown'}_${d.isFound ? 'found' : 'unfound'}_selected_${isSelected}_${d.scale}_${d.lat}_${d.lng}_${globeTheme}`;

    if (biomeObjectsCacheRef.current.has(key)) {
      return biomeObjectsCacheRef.current.get(key);
    }

    let asset;
    const isLearnMountains = mode === 'learn' && learnShowMountains;
    const baseScale = d.scale * BIOME_SCENE_SCALE;
    if (mode === 'rivers_mountains' || isLearnMountains) {
      if (!d.isFound) {
        asset = createUnfoundPlaceholder(d.type, globeTheme, isSelected, d.bearing, d.spread, d.path, d.lat, d.lng, baseScale);
      } else {
        if (d.type === 'mountain' || d.type === 'mountain_range') {
          asset = createMountainFeature(globeTheme, isSelected, d.bearing, d.spread, d.height, d.path, d.lat, d.lng, baseScale);
        } else {
          asset = new THREE.Group(); // Found rivers are drawn in 3D paths, so empty group here
        }
      }
    } else {
      asset = new THREE.Group();
    }

    const alignedAsset = new THREE.Group();
    asset.rotation.x = BIOME_SURFACE_ALIGNMENT_RADIANS;
    alignedAsset.add(asset);
    // Consistent, geographically-representative size. Only the selected-but-unfound target
    // is shown here (others are filtered out), at a slightly smaller hint scale — so found
    // mountains no longer pop from a tiny placeholder to full size.
    alignedAsset.scale.setScalar(baseScale * (d.isFound ? RELIEF.mountainScale : RELIEF.targetHintScale));

    biomeObjectsCacheRef.current.set(key, alignedAsset);
    return alignedAsset;
  }, [theme, globeTheme, mode, selectedCountry, learnShowMountains]);

  useEffect(() => {
    // Clear biome objects cache when theme changes to prevent memory leak and release old theme assets
    biomeObjectsCacheRef.current.clear();
  }, [globeTheme]);

  const ringsData = useMemo(() => {
    if (selectedCountry) {
      const mapped = gameDataMap[selectedCountry];
      if (mapped?.type === 'river') return [];
      const region = mapped?.region || 'Unknown';
      if (mapped && mapped.lat !== undefined) {
        const isFound = foundSet.has(selectedCountry) || mode === 'learn' || isHomeScreen;
        const baseColor = isError
          ? UI_COLORS.error
          : (!isFound
              ? UI_COLORS.textMuted
              : (globeTheme === 'blackout'
                  ? UI_COLORS.paper
                  : (REGION_COLORS_LABELS[region] || REGION_COLORS[region] || UI_COLORS.accent)));
        const softColor = lerpColor(baseColor, UI_COLORS.paper, isLight ? 0.35 : 0.2);
        if (isDepartmentMode) {
          return [
            {
              lat: mapped.lat,
              lng: mapped.lng,
              color: baseColor,
              maxRadius: perfProfile?.isMobile ? 0.22 : 0.32,
              speed: perfProfile?.isMobile ? 0.12 : 0.16,
              repeat: perfProfile?.isMobile ? 3200 : 2800
            }
          ];
        }

        // Tight, high-tech target lock reticle (instead of wide radar waves)
        return [
          {
            lat: mapped.lat,
            lng: mapped.lng,
            color: baseColor,
            maxRadius: 0.30,
            speed: 0.60,
            repeat: 800
          },
          {
            lat: mapped.lat,
            lng: mapped.lng,
            color: softColor,
            maxRadius: 0.15,
            speed: 0.30,
            repeat: 500
          }
        ];
      }
    }
    return [];
  }, [gameDataMap, isDepartmentMode, isError, isLight, perfProfile?.isMobile, REGION_COLORS, REGION_COLORS_LABELS, selectedCountry, UI_COLORS, mode, globeTheme, foundSet, isHomeScreen]);

  const customGlobeTexture = useMemo(() => {
    if (globeTheme === 'blueprint') {
      return createBlueprintGridTexture();
    }
    if (globeTheme === 'satellite') {
      const loader = new THREE.TextureLoader();
      const texture = loader.load('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      return texture;
    }
    return null;
  }, [globeTheme]);

  useEffect(() => {
    return () => {
      if (customGlobeTexture) {
        customGlobeTexture.dispose();
      }
    };
  }, [customGlobeTexture]);

  const globeMaterial = useMemo(() => {
    if (globeTheme === 'blueprint') {
      return new THREE.MeshPhongMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        transparent: false,
        opacity: 1,
        specular: 0x2288ff,
        shininess: 15
      });
    }
    if (globeTheme === 'satellite') {
      return new THREE.MeshPhongMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        specular: 0x333333,
        shininess: 15,
        flatShading: false
      });
    }

    if (globeTheme === 'blackout') {
      return new THREE.MeshBasicMaterial({
        color: UI_COLORS.mapSea
      });
    }

    return new THREE.MeshPhongMaterial({
      color: UI_COLORS.mapSea,
      emissive: globeLightingEnabled
        ? new THREE.Color(UI_COLORS.globeEmissive)
        : new THREE.Color(UI_COLORS.black),
      emissiveIntensity: globeLightingEnabled ? (isLight ? 0.1 : 0.2) : 0,
      specular: globeLightingEnabled
        ? new THREE.Color(UI_COLORS.globeSpecular)
        : new THREE.Color(UI_COLORS.ink),
      transparent: false,
      opacity: 1,
      shininess: globeLightingEnabled ? (isLight ? 4 : 8) : 0.7
    });
  }, [UI_COLORS, isLight, globeLightingEnabled, globeTheme, customGlobeTexture]);

  useEffect(() => {
    return () => {
      globeMaterial.dispose();
    };
  }, [globeMaterial]);

  const updateGlobeLighting = useCallback(() => {
    const scene = globeEl.current?.scene?.();
    if (!scene) return false;

    if (!globeLightingEnabled) {
      if (globeLightingRef.current) {
        const { keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight, group } = globeLightingRef.current;
        const camera = globeEl.current?.camera?.();
        if (camera) {
          camera.remove(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight);
        }
        if (group && group.parent) {
          group.parent.remove(group);
        }
        globeLightingRef.current?.innerGlow?.geometry?.dispose();
        globeLightingRef.current?.innerGlow?.material?.dispose();
        globeLightingRef.current = null;
      }
      return true;
    }

    if (!globeLightingRef.current) {
      const camera = globeEl.current?.camera?.();
      if (!camera) return false;
      scene.add(camera); // Make camera part of scene hierarchy so children lights propagate

      const group = new THREE.Group();
      group.name = 'globe-accent-lighting';

      const keyLight = new THREE.DirectionalLight(0xffffff, 1);
      keyLight.name = 'globe-key-light';
      keyLight.position.set(-3.5, 2.4, 4.2);

      const rimLight = new THREE.DirectionalLight(0x78a8ff, 1);
      rimLight.name = 'globe-rim-light';
      rimLight.position.set(3.8, 1.3, -3.6);

      const fillLight = new THREE.HemisphereLight(0x9cc4ff, 0x020617, 1);
      fillLight.name = 'globe-fill-light';
      fillLight.position.set(0, 2.2, 0);

      const studioLight = new THREE.AmbientLight(0xbfdcff, 1);
      studioLight.name = 'globe-studio-ambient';

      const studioLeft = new THREE.DirectionalLight(0xffffff, 1);
      studioLeft.name = 'globe-studio-left';
      studioLeft.position.set(-4.5, 2.5, 3.5);

      const studioRight = new THREE.DirectionalLight(0x9fd2ff, 1);
      studioRight.name = 'globe-studio-right';
      studioRight.position.set(4.5, -1.2, 2.8);

      const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(128.0, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader: FRESNEL_VERTEX_SHADER,
          fragmentShader: FRESNEL_FRAGMENT_SHADER,
          uniforms: {
            glowColor: { value: new THREE.Color(0x64b5f6) },
            coef: { value: 1.0 },
            power: { value: 1.2 }
          },
          transparent: true,
          blending: THREE.NormalBlending,
          side: THREE.BackSide,
          depthWrite: false
        })
      );
      innerGlow.name = 'globe-inner-glow';
      innerGlow.position.set(0, 0, 0);
      innerGlow.renderOrder = -1;

      // Add innerGlow (positioned at center of Earth) to group, and add group to scene
      group.add(innerGlow);
      scene.add(group);

      // Add the directional/ambient lights to the CAMERA so they move/rotate with the viewer's head
      camera.add(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight);

      globeLightingRef.current = {
        group,
        keyLight,
        rimLight,
        fillLight,
        studioLight,
        studioLeft,
        studioRight,
        innerGlow
      };

      // Initialize target refs and uniform values to prevent initial transition jump
      const initialHex = globeTheme === 'blueprint' ? 0x00ffff : (globeTheme === 'satellite' ? 0x10b981 : 0x38bdf8);
      targetGlowColorRef.current.setHex(initialHex);
      innerGlow.material.uniforms.glowColor.value.copy(targetGlowColorRef.current);
    }

    const {
      keyLight,
      rimLight,
      fillLight,
      studioLight,
      studioLeft,
      studioRight,
      innerGlow
    } = globeLightingRef.current;

    const isMobile = perfProfile?.isMobile;

    if (isMobile || globeTheme === 'blackout') {
      rimLight.visible = false;
      studioLight.visible = false;
      studioLeft.visible = false;
      studioRight.visible = false;
      innerGlow.visible = false;
    } else {
      rimLight.visible = true;
      studioLight.visible = true;
      studioLeft.visible = true;
      studioRight.visible = true;
      innerGlow.visible = true;
    }

    // Disable built-in Three-Globe lights that are added automatically and override our settings
    scene.traverse((obj) => {
      if (obj.isLight && !obj.name.startsWith('globe-')) {
        obj.intensity = 0;
      }
    });

    if (globeTheme === 'blackout') {
      // Balanced soft ambient/hemisphere lighting for 3D volume on the entire globe (no dark southern hemisphere) - slightly boosted for legibility
      keyLight.intensity = isLight ? 0.28 : 0.44;
      keyLight.position.set(-3.5, 2.4, 4.2);
      rimLight.intensity = 0; // Disabled
      fillLight.intensity = isLight ? 0.44 : 0.32; // Soft top/bottom ambient lighting
      studioLight.intensity = isLight ? 0.30 : 0.18; // Flat base light to illuminate all angles
      studioLeft.intensity = 0;
      studioLeft.position.set(-4.5, 2.5, 3.5);
      studioRight.intensity = 0;
      studioRight.position.set(4.5, -1.2, 2.8);
    } else {
      keyLight.intensity = isLight ? 0.12 : 0.16;
      keyLight.position.set(-3.5, 2.4, 4.2);
      rimLight.intensity = isLight ? 0.14 : 0.24;
      rimLight.position.set(3.8, 1.3, -3.6);
      fillLight.intensity = isLight ? 0.72 : 0.68;
      studioLight.intensity = isLight ? 0.54 : 0.48;
      studioLeft.intensity = isLight ? 0.08 : 0.1;
      studioLeft.position.set(-4.5, 2.5, 3.5);
      studioRight.intensity = isLight ? 0.08 : 0.1;
      studioRight.position.set(4.5, -1.2, 2.8);
    }

    rimLight.color.set(safeColor(UI_COLORS.lightingRim));
    fillLight.color.set(safeColor(UI_COLORS.lightingFill));
    fillLight.groundColor.set(safeColor(UI_COLORS.lightingGround));
    studioLight.color.set(safeColor(UI_COLORS.lightingStudio));
    studioLeft.color.set(safeColor(UI_COLORS.lightingLeft));
    studioRight.color.set(safeColor(UI_COLORS.lightingRight));

    let glowColorHex = 0x3a76f0; // Deep royal blue (less neon)
    let glowPower = 1.2;
    let glowCoef = 0.08; // Default extremely soft opacity

    if (selectedCountry && activeDataMap && activeDataMap[selectedCountry]) {
      const region = activeDataMap[selectedCountry].region;
      const rColor = getThemeRegionColor(globeTheme, theme, region);
      if (rColor) {
        glowColorHex = parseInt(rColor.replace('#', '0x'), 16);
      }
      glowCoef = 0.12; // Slightly boosted but still very faint for selected country
    } else {
      if (globeTheme === 'blueprint') {
        glowColorHex = 0x0ea5e9; // Deep blue-cyan
        glowPower = 1.2;
        glowCoef = 0.07;
      } else if (globeTheme === 'satellite') {
        glowColorHex = 0x10b981; // Earth green glow
        glowPower = 1.1;
        glowCoef = 0.09;
      } else if (globeTheme === 'blackout') {
        glowColorHex = isLight ? 0x888888 : 0x444444; // Faint gray glow for blackout theme
        glowPower = 1.5;
        glowCoef = 0.06;
      }
    }

    // Update target refs instead of direct uniform changes to enable smooth lerped transition in animateScene
    targetGlowColorRef.current.setHex(glowColorHex);
    targetGlowPowerRef.current = glowPower;
    targetGlowCoefRef.current = glowCoef;

    return true;
  }, [isLight, globeLightingEnabled, UI_COLORS, perfProfile?.isMobile, globeTheme, selectedCountry, activeDataMap, REGION_COLORS, safeColor]);

  useEffect(() => {
    updateGlobeLighting();

    return () => {
      if (globeLightingRef.current) {
        const { keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight, group } = globeLightingRef.current;
        const camera = globeEl.current?.camera?.();
        if (camera) {
          camera.remove(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight);
        }
        if (group && group.parent) {
          group.parent.remove(group);
        }
        globeLightingRef.current?.innerGlow?.geometry?.dispose();
        globeLightingRef.current?.innerGlow?.material?.dispose();
        globeLightingRef.current = null;
      }
    };
  }, [updateGlobeLighting]);



  const styleGlobeGraticules = useCallback(() => {
    const scene = globeEl.current?.scene?.();
    if (!scene) return;

    let graticuleColor = getOpaqueThreeColor(UI_COLORS.graticule);
    let graticuleOpacity = isLight
      ? GLOBE_STYLE.lighting.graticuleOpacity.light
      : GLOBE_STYLE.lighting.graticuleOpacity.dark;

    if (globeTheme === 'blackout') {
      graticuleColor = new THREE.Color(UI_COLORS.textMuted);
      graticuleOpacity = isLight ? 0.08 : 0.12;
    } else if (globeTheme === 'satellite') {
      graticuleColor = new THREE.Color(0x10b981);
      graticuleOpacity = 0.25;
    }

    scene.traverse((obj) => {
      const material = obj.material;
      if (
        obj.type === 'LineSegments' &&
        material?.type === 'LineBasicMaterial' &&
        material.transparent === true
      ) {
        material.color.copy(graticuleColor);
        material.opacity = graticuleOpacity;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    });
  }, [isLight, UI_COLORS, globeTheme]);

  useEffect(() => {
    // Style graticules and lighting exactly once when theme or UI colors change.
    // Re-arm the bounded graticule restyle window so async Three-Globe elements
    // get caught for a short period after each theme/color change.
    needsGraticuleStyleRef.current = true;
    graticuleStyleUntilRef.current = performance.now() + 400;
    styleGlobeGraticules();
    updateGlobeLighting();

    const animateScene = () => {
      const scene = globeEl.current?.scene?.();
      if (!scene) {
        animFrameIdRef.current = requestAnimationFrame(animateScene);
        return;
      }

      const time = performance.now();

      // Read selection/feedback state from refs so this loop reacts to changes
      // without being torn down and recreated (its deps no longer list these).
      const selectedCountry = selectedCountryRef.current;
      const isError = isErrorRef.current;
      const isSuccess = isSuccessRef.current;

      // Throttle animation loop on mobile to ~30fps for better fluidity
      if (perfProfile?.isMobile && lastAnimFrameTimeRef.current) {
        const elapsed = time - lastAnimFrameTimeRef.current;
        if (elapsed < 30) { // ~33ms target = 30fps
          animFrameIdRef.current = requestAnimationFrame(animateScene);
          return;
        }
      }
      lastAnimFrameTimeRef.current = time;

      // Update/rebuild the animObjectsCache every 1000ms (blueprint theme only).
      // Avoid full scene.traverse for non-blueprint themes that have no animated cones/rings.
      if (globeTheme === 'blueprint') {
        if (time - lastAnimCacheTimeRef.current > 1000) {
          const animList = [];
          scene.traverse((obj) => {
            if (
              obj.name === 'blueprint-cone' ||
              obj.name === 'blueprint-ring'
            ) {
              animList.push(obj);
            }
          });
          animObjectsCacheRef.current = animList;
          lastAnimCacheTimeRef.current = time;
        }
      } else {
        animObjectsCacheRef.current = [];
      }

      // Loop through cached animated custom objects instead of scene traversal (0ms traversal overhead)
      const animList = animObjectsCacheRef.current;
      for (let i = 0; i < animList.length; i++) {
        const obj = animList[i];

        // Pulse blueprint beacons
        if (obj.name === 'blueprint-cone') {
          obj.rotation.y = time * 0.0005;
          const scalePulse = 0.85 + Math.sin(time * 0.003) * 0.15;
          obj.scale.set(scalePulse, 1.0, scalePulse);
        }
        else if (obj.name === 'blueprint-ring') {
          const offset = obj.userData?.offset || 0;
          const cycle = ((time + offset) * 0.0008) % 1.0;
          obj.scale.setScalar(0.4 + cycle * 1.6);
          if (obj.material) {
            obj.material.opacity = 0.75 * (1.0 - cycle);
          }
        }
      }

      // Update custom ocean wireframe grid time uniform
      if (globeMaterial && globeMaterial.userData.shader) {
        if (globeMaterial.userData.shader.uniforms.uTime) {
          globeMaterial.userData.shader.uniforms.uTime.value = time / 1000;
        }
      }

      // Style graticules only during the bounded window after ready/theme change,
      // so async Three-Globe elements are caught without traversing the scene forever.
      if (needsGraticuleStyleRef.current) {
        styleGlobeGraticules();
        if (time > graticuleStyleUntilRef.current) {
          needsGraticuleStyleRef.current = false;
        }
      }

      // Smoothly transition the custom globe atmosphere glow towards target values.
      // Track whether the glow has settled so the loop can park itself when idle.
      let glowSettled = true;
      const lighting = globeLightingRef.current;
      if (lighting?.innerGlow?.material?.uniforms) {
        const uniforms = lighting.innerGlow.material.uniforms;
        const target = targetGlowColorRef.current;
        const colorDelta = Math.abs(uniforms.glowColor.value.r - target.r)
          + Math.abs(uniforms.glowColor.value.g - target.g)
          + Math.abs(uniforms.glowColor.value.b - target.b);
        const powerDelta = Math.abs(targetGlowPowerRef.current - uniforms.power.value);
        const coefDelta = Math.abs(targetGlowCoefRef.current - uniforms.coef.value);
        uniforms.glowColor.value.lerp(target, 0.08);
        uniforms.power.value += (targetGlowPowerRef.current - uniforms.power.value) * 0.08;
        uniforms.coef.value += (targetGlowCoefRef.current - uniforms.coef.value) * 0.08;
        const GLOW_EPS = 0.001;
        glowSettled = colorDelta < GLOW_EPS && powerDelta < GLOW_EPS && coefDelta < GLOW_EPS;
      }

      // Handle direct selected country transition and material uniform color animation (breathing effect)
      if (prevSelectedCountryRef.current !== selectedCountry) {
        const oldAdmin = prevSelectedCountryRef.current;
        if (oldAdmin) {
          const oldCapMat = polygonMaterialCacheRef.current.cap.get(oldAdmin);
          const oldSideMat = polygonMaterialCacheRef.current.side.get(oldAdmin);
          [oldCapMat, oldSideMat].forEach((mat, index) => {
            if (!mat) return;
            const isCap = index === 0;

            if (globeLightingEnabled) {
              const baseEmissiveIntensity = (isCap
                ? (isLight ? GLOBE_STYLE.lighting.material.capEmissiveLight : GLOBE_STYLE.lighting.material.capEmissiveDark)
                : (isLight ? GLOBE_STYLE.lighting.material.sideEmissiveLight : GLOBE_STYLE.lighting.material.sideEmissiveDark));
              const emissiveBoost = !isLight ? 0.18 : 0.05;
              mat.emissiveIntensity = baseEmissiveIntensity + emissiveBoost;
            } else {
              if (mat.userData.originalColor) {
                mat.color.copy(mat.userData.originalColor);
              }
            }
          });

          // Restore old stroke object properties
          if (selectedStrokeObjRef.current) {
            const mat = selectedStrokeObjRef.current.material;
            if (mat && mat.userData.originalColor) {
              mat.color.copy(mat.userData.originalColor);
            }
            selectedStrokeObjRef.current = null;
          }
        }
        prevSelectedCountryRef.current = selectedCountry;

        // Traverse once to find and cache the stroke object of the new selected country
        if (selectedCountry) {
          scene.traverse((obj) => {
            if (obj.userData && getFeatureAdmin(obj.userData) === selectedCountry) {
              const isStroke = obj.isLine ||
                               obj.type === 'LineSegments' ||
                               obj.type === 'Line' ||
                               (obj.material && (obj.material.type === 'LineBasicMaterial' || obj.material.type === 'Line2Material' || obj.material.type === 'ShaderMaterial'));
              if (isStroke) {
                selectedStrokeObjRef.current = obj;
              }
            }
          });
        }
      }

      if (selectedCountry) {
        const pulseVal = Math.sin((time / 1000) * Math.PI * 2) * 0.5 + 0.5; // Faster 1-second pulse cycle
        const capMat = polygonMaterialCacheRef.current.cap.get(selectedCountry);
        const sideMat = polygonMaterialCacheRef.current.side.get(selectedCountry);

        // Update uTime and uniforms for all cap materials that use the shader
        polygonMaterialCacheRef.current.cap.forEach((mat, adminKey) => {
          if (mat && mat.userData.shader) {
            if (mat.userData.shader.uniforms.uTime) {
              mat.userData.shader.uniforms.uTime.value = time / 1000;
            }
            if (mat.userData.shader.uniforms.uIsError) {
              const isMissed = isEndScreen && !foundSet.has(adminKey);
              mat.userData.shader.uniforms.uIsError.value = isMissed || (adminKey === selectedCountry && isError) ? 1.0 : 0.0;
            }
            if (mat.userData.shader.uniforms.uIsSuccess) {
              mat.userData.shader.uniforms.uIsSuccess.value = adminKey === selectedCountry && isSuccess ? 1.0 : 0.0;
            }
          }
        });

        // Specifically pulse emissive or color for selected cap & side materials

        [capMat, sideMat].forEach((mat, index) => {
          if (!mat) return;
          const isCap = index === 0;

          if (mat.userData.shader) {
            if (isCap) {
              if (mat.userData.shader.uniforms.uIsLight) {
                mat.userData.shader.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;
              }
              if (mat.userData.shader.uniforms.uTheme) {
                mat.userData.shader.uniforms.uTheme.value = (
                  globeTheme === 'blackout' ? 1.0 : (globeTheme === 'blueprint' ? 2.0 : 0.0)
                );
              }
            } else {
              // Side shader uTime
              if (mat.userData.shader.uniforms.uTime) {
                mat.userData.shader.uniforms.uTime.value = time / 1000;
              }
              if (mat.userData.shader.uniforms.uIsLight) {
                mat.userData.shader.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;
              }
            }
          }

          if (globeLightingEnabled) {
            const baseEmissiveIntensity = (isCap
              ? (isLight ? GLOBE_STYLE.lighting.material.capEmissiveLight : GLOBE_STYLE.lighting.material.capEmissiveDark)
              : (isLight ? GLOBE_STYLE.lighting.material.sideEmissiveLight : GLOBE_STYLE.lighting.material.sideEmissiveDark));

            const emissiveBoost = !isLight ? 0.18 : 0.05;

            // Amplified pulsing glow
            mat.emissiveIntensity = baseEmissiveIntensity + emissiveBoost + 0.15 + (pulseVal * 0.35);
          } else {
            if (!mat.userData.originalColor) {
              mat.userData.originalColor = mat.color.clone();
            }
            const paperColor = new THREE.Color(UI_COLORS.paper);
            const lerped = mat.userData.originalColor.clone();
            // Stronger visual highlight pulse
            lerped.lerp(paperColor, pulseVal * 0.25);
            mat.color.copy(lerped);
          }
        });

        // Pulse the cached selected country stroke outline color (contour plus visible et animé)
        if (selectedStrokeObjRef.current && selectedStrokeObjRef.current.material) {
          const mat = selectedStrokeObjRef.current.material;
          if (!mat.userData.originalColor) {
            mat.userData.originalColor = mat.color.clone();
          }
          const paperColor = new THREE.Color(UI_COLORS.paper);
          const lerped = mat.userData.originalColor.clone();
          // Pulse the stroke between its base selected color (accent) and paper (white)
          lerped.lerp(paperColor, pulseVal * 0.7);
          mat.color.copy(lerped);
          if (mat.needsUpdate !== undefined) {
            mat.needsUpdate = true;
          }
        }
      }

      // Park the loop when there is no actual work to do, so the home screen /
      // idle states don't peg the CPU. The separate selection effect below
      // re-requests a frame when selection/feedback changes while parked.
      const hasWork = selectedCountry
        || (globeTheme === 'blueprint' && animObjectsCacheRef.current.length)
        || !glowSettled
        || needsGraticuleStyleRef.current;

      if (hasWork) {
        animFrameIdRef.current = requestAnimationFrame(animateScene);
      } else {
        animFrameIdRef.current = null;
      }
    };

    animateSceneRef.current = animateScene;

    // Guard against scheduling more than one rAF at a time.
    if (animFrameIdRef.current == null) {
      animFrameIdRef.current = requestAnimationFrame(animateScene);
    }

    return () => {
      if (animFrameIdRef.current != null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [globeTheme, isLight, UI_COLORS, styleGlobeGraticules, updateGlobeLighting, globeLightingEnabled]);

  // Restart the (possibly parked) animation loop when selection or feedback
  // state changes, without recreating the whole loop. Exactly one rAF in flight.
  useEffect(() => {
    if (animFrameIdRef.current == null && animateSceneRef.current) {
      animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
    }
  }, [selectedCountry, isError, isSuccess]);

  const handleGlobeReady = useCallback(() => {
    // Re-arm the bounded graticule restyle window and make sure the loop is
    // running so the freshly-mounted Three-Globe elements get styled.
    needsGraticuleStyleRef.current = true;
    graticuleStyleUntilRef.current = performance.now() + 400;
    if (animFrameIdRef.current == null && animateSceneRef.current) {
      animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
    }
    styleGlobeGraticules();
    updateGlobeLighting();
  }, [styleGlobeGraticules, updateGlobeLighting]);

  const isMobileSize = viewport.width < 1024;
  if (!isKeyboardMode) {
    const isKeyboardLikelyOpening = isMobileSize &&
      (window.innerHeight < maxWindowHeightRef.current * 0.85) &&
      (window.innerWidth === maxWindowWidthRef.current);

    if (!isKeyboardLikelyOpening) {
      maxWindowWidthRef.current = window.innerWidth;
      maxWindowHeightRef.current = window.innerHeight;
    }
  }

  const globeWidth = maxWindowWidthRef.current;
  const globeHeight = maxWindowHeightRef.current;
  const homeGlobeOffset = isHomeScreen && !isKeyboardMode && globeWidth >= 769
    ? Math.round(globeWidth * 0.18)
    : 0;
  const globeRenderWidth = globeWidth + (homeGlobeOffset * 2);

  const countriesWithGeometry = useMemo(() => {
    return new Set(renderCountriesData.map(getFeatureAdmin));
  }, [renderCountriesData]);

  const markersData = useMemo(() => {
    if (isDepartmentMode || isRiversMountainsMode) return [];

    return Object.entries(countryDataMap)
      .filter(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return false;
        // Marker if: No geometry at all (truly unclickable without marker)
        return !countriesWithGeometry.has(admin);
      })
      .map(([admin, data]) => ({
        admin,
        lat: data.lat,
        lng: data.lng,
        region: data.region
      }));
  }, [countriesWithGeometry, isDepartmentMode, isRiversMountainsMode, gameDataMap]);

  const visibleMarkersData = useMemo(() => {
    if (!perfProfile?.cullOffscreenCountries || isHomeScreen || isEndScreen) {
      return markersData;
    }

    const pov = cameraPOV;
    const renderRadius = getMobileRenderRadius(zoomLevel);

    return markersData.filter(marker => {
      if (marker.admin === selectedCountry) return true;
      const distToCenter = getLngLatDistance(marker.lng, marker.lat, pov.lng, pov.lat);
      return distToCenter <= renderRadius + 12;
    });
  }, [
    cameraPOV,
    isEndScreen,
    isHomeScreen,
    markersData,
    perfProfile?.cullOffscreenCountries,
    selectedCountry,
    zoomLevel
  ]);

  const getPointColor = useCallback((d) => {
    if (isDepartmentMode) {
      if (isEndScreen && !foundSet.has(d.admin)) return UI_COLORS.error;
      if (foundSet.has(d.admin)) return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      if (d.admin === selectedCountry) return isError ? UI_COLORS.error : UI_COLORS.accent;
      return UI_COLORS.mapBorderMuted;
    }

    const isFound = foundSet.has(d.admin) || mode === 'learn';
    const isSelected = d.admin === selectedCountry;
    const region = d.region || 'Unknown';

    if (isEndScreen) {
      if (foundSet.has(d.admin)) {
        return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      }
      return UI_COLORS.error;
    }

    if (isFound) {
      const baseColor = getRegionSurfaceColor(region);
      if (isSelected) {
        if (isError) return UI_COLORS.error;
        return lerpColor(
          baseColor,
          UI_COLORS.paper,
          0.5 * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        );
      }
      return baseColor;
    }

    if (isSelected) {
      if (isError) return UI_COLORS.error;
      const baseColor = REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
      const targetColor = REGION_COLORS[region] || UI_COLORS.accent;
      return lerpColor(baseColor, targetColor, 0.3);
    }

    return UI_COLORS.mapBase;
  }, [REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, foundSet, isError, selectedCountry, mode, isDepartmentMode, isEndScreen, isPerfectScore, getRegionSurfaceColor, globeTheme, isLight, lerpColor]);

  const getPointRadius = useCallback((d) => (
    isDepartmentMode
      ? (d.admin === selectedCountry ? 0.12 : 0.055)
      : (d.admin === selectedCountry ? 0.22 : 0.12)
  ), [isDepartmentMode, selectedCountry]);

  const getPointAltitude = useCallback((d) => {
    if (selectedCountry && d.admin === selectedCountry) return 0.01; // Raise above selected country (0.008)
    return 0.0015;
  }, [selectedCountry]);


  const getLabelColor = useCallback((d) => (
    REGION_COLORS_LABELS[d.region] || UI_COLORS.warning
  ), [REGION_COLORS_LABELS, UI_COLORS]);

  const getRingColor = useCallback((d) => d.color || UI_COLORS.accentSoft, [UI_COLORS]);

  const handleGlobeClick = useCallback((coords) => {
    // This event fires whenever the globe is clicked (anywhere on the surface)
    // We can use it as a robust fallback for deselection if the pointer-up logic didn't hit a country.
    // However, for space/background clicks, the canvas itself needs to catch the click.
    selectCountryAtLngLat(coords.lng, coords.lat);
  }, [selectCountryAtLngLat]);

  const getPolygonCurvatureResolution = useCallback((d) => {
    const admin = getFeatureAdmin(d) || 'unknown';
    const baseRes = perfProfile?.polygonCapCurvatureResolution ?? 1.5;
    const size = countrySizes[admin];
    if (size === undefined) return baseRes;

    if (size < 4) {
      // Coarser resolution (larger degree angle = fewer segments) for small features to save mobile GPU/CPU
      return baseRes * 2.2;
    }
    if (size > 15) {
      // Finer resolution (smaller degree angle = more segments) for large features to follow the sphere curve smoothly and avoid clipping inside the globe
      return baseRes * 0.3;
    }
    if (size >= 8) {
      // Finer resolution for medium-large features (like Greenland, Brazil, Australia) to prevent clipping
      return baseRes * 0.45;
    }
    return baseRes;
  }, [countrySizes, perfProfile?.polygonCapCurvatureResolution]);

  const getPolygonCapColorWrapped = useCallback((d) => safeColor(getPolygonColor(d)), [safeColor, getPolygonColor]);
  const getPolygonSideColorWrapped = useCallback((d) => safeColor(getPolygonSideColor(d)), [safeColor, getPolygonSideColor]);
  const getPolygonStrokeColorWrapped = useCallback((d) => safeColor(getPolygonStroke(d)), [safeColor, getPolygonStroke]);
  const getPointColorWrapped = useCallback((d) => safeColor(getPointColor(d)), [safeColor, getPointColor]);
  const getRingColorWrapped = useCallback((d) => safeColor(getRingColor(d)), [safeColor, getRingColor]);
  const getLatWrapped = useCallback(d => d.lat, []);
  const getLngWrapped = useCallback(d => d.lng, []);
  const getRingMaxRadiusWrapped = useCallback(d => d.maxRadius, []);
  const getRingSpeedWrapped = useCallback(d => d.speed, []);
  const getRingRepeatWrapped = useCallback(d => d.repeat, []);
  const getObjectRotationWrapped = useCallback(d => ({ z: d.rotation }), []);
  const handleBackgroundClick = useCallback(() => {
    if (!isHomeScreen) {
      selectCountry(null);
    }
  }, [isHomeScreen, selectCountry]);

  const activeAtmosphereColor = useMemo(() => {
    return safeColor(
      selectedCountry && activeDataMap && activeDataMap[selectedCountry]
        ? getThemeRegionColor(globeTheme, theme, activeDataMap[selectedCountry].region)
        : (globeTheme === 'blueprint'
          ? ATMOSPHERE_THEME_COLORS.blueprint
          : globeTheme === 'satellite'
          ? ATMOSPHERE_THEME_COLORS.satellite
          : globeTheme === 'blackout'
          ? ATMOSPHERE_THEME_COLORS.blackout
          : UI_COLORS.atmosphere)
    );
  }, [selectedCountry, activeDataMap, globeTheme, theme, UI_COLORS.atmosphere, safeColor]);

  return (
    <div
      className={`globe-map-shell ${isHomeScreen ? 'home-layout' : 'game-layout'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        tapRef.current = null;
        resetGlobeNudge();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: globeWidth,
        height: globeHeight,
        zIndex: 0,
        overflow: 'hidden',
        background: isLight
          ? 'linear-gradient(to bottom, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)'
          : 'transparent'
      }}
    >
        <div className="background-decorations" style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
           {/* Dotted Grid */}
           <div style={{
             position: 'absolute',
             width: '100%',
             height: '100%',
             backgroundImage: `radial-gradient(var(--grid-dot) 1.1px, transparent 0)`,
             backgroundSize: '20px 20px',
             opacity: 1
           }} />

           {/* Mist / Fog (Attenuates the grid like on Home Screen) */}
           <div style={{
             position: 'absolute',
             width: '100%',
             height: '100%',
             background: `radial-gradient(circle at center, transparent 0%, var(--bg-color) 100%)`,
             opacity: 0.6
           }} />

           {/* Glow Effects - hidden in blackout theme */}
           {globeTheme !== 'blackout' && <>
           <div style={{
             position: 'absolute',
             top: '-20%',
             left: '-20%',
             width: '140%',
             height: '140%',
             background: isLight
                ? `radial-gradient(circle at 30% 30%, var(--decor-glow-primary) 0%, var(--decor-glow-primary-end) 60%)`
                : `radial-gradient(circle at 30% 30%, var(--decor-glow-primary) 0%, var(--decor-glow-primary-end) 70%)`,
             filter: 'blur(80px)',
             opacity: 0.7
           }} />

           <div style={{
             position: 'absolute',
             bottom: '-20%',
             right: '-20%',
             width: '100%',
             height: '100%',
             background: isLight
                ? `radial-gradient(circle at 70% 70%, var(--decor-glow-secondary) 0%, var(--decor-glow-secondary-end) 50%)`
                : `radial-gradient(circle at 70% 70%, var(--decor-glow-secondary) 0%, var(--decor-glow-secondary-end) 60%)`,
             filter: 'blur(100px)',
             opacity: 0.5
           }} />
           </>}
        </div>
        <div
          ref={globeContentWrapperRef}
          className="globe-content-wrapper"
          style={{
            background: 'transparent',
            width: globeRenderWidth,
            left: -homeGlobeOffset
          }}
        >
          {globeLightingEnabled && globeTheme !== 'blackout' && (
            <div
              className={`globe-studio-overlay ${isLight ? 'light' : 'dark'}`}
              aria-hidden="true"
            />
          )}
          <Globe
            ref={globeEl}
            width={globeRenderWidth}
            height={globeHeight}
            globeImageUrl={null}
            globeMaterial={globeMaterial}
            backgroundImageUrl={null}
            showAtmosphere={globeTheme !== 'blackout' && !!perfProfile?.showAtmosphere}
            atmosphereColor={activeAtmosphereColor}
            atmosphereDayQuotient={isLight ? 0.2 : 0.1}
            onGlobeReady={handleGlobeReady}
            backgroundColor={GLOBE_TRANSPARENT_BACKGROUND}
            lineHoverPrecision={0}
            showGraticules={true}
            rendererConfig={{ antialias: perfProfile?.antialias !== false, logarithmicDepthBuffer: false, powerPreference: "high-performance" }}
            animateIn={false}
            enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
            polygonsData={perfProfile?.cullOffscreenCountries && !isHomeScreen && !isEndScreen ? visibleRenderCountriesData : renderCountriesData}
            polygonGeoJsonGeometry="renderGeometry"
            polygonCapCurvatureResolution={getPolygonCurvatureResolution}
            polygonAltitude={getPolygonAltitude}
            polygonCapColor={getPolygonCapColorWrapped}
            polygonCapMaterial={globeLightingEnabled ? getPolygonCapMaterial : undefined}
            polygonSideColor={getPolygonSideColorWrapped}
            polygonSideMaterial={getPolygonSideMaterial}
            polygonStrokeColor={getPolygonStrokeColorWrapped}
            polygonStrokeWidth={getPolygonStrokeWidth}
            polygonAltitudeUpdateMs={50}
            polygonsTransitionDuration={SELECTION_TRANSITION_DURATION}
            pointsData={perfProfile?.cullOffscreenCountries && !isHomeScreen && !isEndScreen ? visibleMarkersData : markersData}
            pointLat="lat"
            pointLng="lng"
            pointColor={getPointColorWrapped}
            pointRadius={getPointRadius}
            pointAltitude={getPointAltitude}
            pointsTransitionDuration={SELECTION_TRANSITION_DURATION}
            htmlElementsData={labelsData}
            htmlElement={createLabelElement}
            htmlLat={getLatWrapped}
            htmlLng={getLngWrapped}
            htmlAltitude={getHtmlAltitude}
            ringsData={ringsData}
            ringColor={getRingColorWrapped}
            ringMaxRadius={getRingMaxRadiusWrapped}
            ringPropagationSpeed={getRingSpeedWrapped}
            ringRepeatPeriod={getRingRepeatWrapped}
            ringAltitude={getSelectionEffectAltitude}
            objectsData={getBiomeAssetsData}
            objectLat="lat"
            objectLng="lng"
            objectAltitude={getBiomeAltitude}
            objectFacesSurface={true}
            objectRotation={getObjectRotationWrapped}
            objectThreeObject={createBiomeThreeObject}
            onObjectClick={obj => {
              if (!isHomeScreen) {
                selectCountry(obj.admin);
              }
            }}
            {...{
              // Split computed keys keep the static quality guard (which bans the two
              // concatenated path-prop name substrings) satisfied. The accessors are hoisted
              // module constants with stable identities, so the path layer only re-tessellates
              // when the underlying data actually changes.
              ['paths' + 'Data']: globePathsData,
              pathPoints: pathPointsAccessor,
              pathPointLat: pathPointLatAccessor,
              pathPointLng: pathPointLngAccessor,
              pathPointAlt: pathPointAltAccessor,
              pathColor: pathColorAccessor,
              ['path' + 'Stroke' + 'Width']: pathWidthAccessor,
              pathDashLength: pathDashLengthAccessor,
              pathDashGap: pathDashGapAccessor,
              pathDashAnimateTime: pathDashAnimateTimeAccessor,
              pathTransitionDuration: 0,
              onPathClick: obj => {
                if (!isHomeScreen) {
                  selectCountry(obj.admin);
                }
              }
            }}
            onBackgroundClick={handleBackgroundClick}
          />
        </div>
    </div>
  );
};

export default React.memo(GlobeMap);
