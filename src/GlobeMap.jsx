import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';
import { THEME, THEME_OVERRIDES, CONTINENT_COLORS, CONTINENT_COLORS_ATTENUATED, CONTINENT_COLORS_LABELS, GLOBE_STYLE, LOW_POLY_TERRAIN_COLORS, GLOBE_TRANSPARENT_BACKGROUND, getOpaqueThreeColor, PROCEDURAL_OCEAN_COLORS, SURFACE_THEME_COLORS, STROKE_THEME_COLORS, ATMOSPHERE_THEME_COLORS, getThemeRegionColor, getThemeRegionColorAttenuated, getThemeRegionColorLabel } from './designSystem';
import { createBiomeAsset, disposeBiomeCache, createMountainFeature, createRiverFeature, createUnfoundPlaceholder } from './LowPolyBiomes';


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

const GLOBE_LAYER_ALTITUDE = {
  // Keep geometry far enough from the globe surface to avoid depth-buffer
  // flickering when the globe is zoomed out, especially on mobile GPUs.
  base: 0.01,
  found: 0.014,
  selected: 0.02,
  label: 0.024
};
const SELECTION_TRANSITION_DURATION = 80; // Snappy transition
const MOBILE_SELECTED_COUNTRY_LAT_OFFSET = 0;
const MOBILE_KEYBOARD_SELECTED_COUNTRY_LAT_OFFSET = 0;
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

const createVintageParchmentTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base parchment beige/cream color
  ctx.fillStyle = PROCEDURAL_OCEAN_COLORS.vintage.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Granular parchment noise
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 11;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise - 2));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise - 5));
  }
  ctx.putImageData(imgData, 0, 0);

  // Stains / Vignette gradient
  const grad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 200,
    canvas.width / 2, canvas.height / 2, canvas.width * 0.72
  );
  grad.addColorStop(0, PROCEDURAL_OCEAN_COLORS.vintage.grad0);
  grad.addColorStop(0.78, PROCEDURAL_OCEAN_COLORS.vintage.grad78);
  grad.addColorStop(1, PROCEDURAL_OCEAN_COLORS.vintage.grad1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rhumb / Windrose mariner lines
  ctx.strokeStyle = PROCEDURAL_OCEAN_COLORS.vintage.line12;
  ctx.lineWidth = 1;
  const centers = [
    { x: canvas.width * 0.28, y: canvas.height * 0.38 },
    { x: canvas.width * 0.72, y: canvas.height * 0.62 }
  ];
  centers.forEach(c => {
    // Rays
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(angle) * 800, c.y + Math.sin(angle) * 800);
      ctx.stroke();
    }

    // Windrose concentric circles
    ctx.beginPath();
    ctx.arc(c.x, c.y, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 46, 0, Math.PI * 2);
    ctx.stroke();

    // Compass stars
    ctx.fillStyle = PROCEDURAL_OCEAN_COLORS.vintage.line28;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const nextAngle = ((i + 1) * Math.PI * 2) / 8;
      const midAngle = angle + Math.PI / 8;

      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(angle) * 35, c.y + Math.sin(angle) * 35);
      ctx.lineTo(c.x + Math.cos(midAngle) * 12, c.y + Math.sin(midAngle) * 12);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Waves in ocean
  ctx.strokeStyle = PROCEDURAL_OCEAN_COLORS.vintage.line07;
  ctx.lineWidth = 1.6;
  for (let y = 80; y < canvas.height - 80; y += 180) {
    for (let x = 60; x < canvas.width; x += 220) {
      if (centers.some(c => Math.hypot(c.x - x, c.y - y) < 140)) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 20, y - 8, x + 40, y + 8, x + 60, y);
      ctx.bezierCurveTo(x + 80, y - 8, x + 100, y + 8, x + 120, y);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

const createSynthwaveGridTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Deep space violet
  ctx.fillStyle = PROCEDURAL_OCEAN_COLORS.synthwave.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Laser grid lines
  ctx.strokeStyle = PROCEDURAL_OCEAN_COLORS.synthwave.line; // neon pink grid
  ctx.lineWidth = 1.8;

  const rows = 20;
  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const cols = 40;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Neon sky/sunset gradients
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, PROCEDURAL_OCEAN_COLORS.synthwave.gradTop); // cyan glow top
  grad.addColorStop(0.5, PROCEDURAL_OCEAN_COLORS.synthwave.gradCenter); // magenta glow center
  grad.addColorStop(1, PROCEDURAL_OCEAN_COLORS.synthwave.gradBottom); // cyan glow bottom
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

const createBlueprintGridTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Blueprint navy/dark paper
  ctx.fillStyle = PROCEDURAL_OCEAN_COLORS.blueprint.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Precision technical blueprint lines
  const rows = 36;
  const cols = 72;

  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * canvas.height;
    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? PROCEDURAL_OCEAN_COLORS.blueprint.lineMajor : PROCEDURAL_OCEAN_COLORS.blueprint.lineMinor;
    ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.8;
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * canvas.width;
    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? PROCEDURAL_OCEAN_COLORS.blueprint.lineMajor : PROCEDURAL_OCEAN_COLORS.blueprint.lineMinor;
    ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.8;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

// --- PROCEDURAL THEMED 3D MODELS BUILDERS ---

const createVintageShip = () => {
  const group = new THREE.Group();
  group.name = 'vintage-ship';
  group.userData = { offset: Math.random() * 1000 };

  // Hull
  const hullMat = new THREE.MeshLambertMaterial({ color: 0x503a27, flatShading: true });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.08), hullMat);
  hull.position.y = 0.0225;
  hull.scale.set(1.25, 1, 1);
  group.add(hull);

  // Bow (cone)
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), hullMat);
  bow.position.set(0.12, 0.0225, 0);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  group.add(bow);

  // Masts & Sails
  const mastMat = new THREE.MeshLambertMaterial({ color: 0x362519 });
  const sailMat = new THREE.MeshLambertMaterial({ color: 0xf5eedc, flatShading: true });

  const mastGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.15, 4);
  const sailGeo = new THREE.BoxGeometry(0.008, 0.065, 0.08);

  // Main Mast
  const mainMast = new THREE.Mesh(mastGeo, mastMat);
  mainMast.position.set(0, 0.095, 0);
  group.add(mainMast);

  const mainSail = new THREE.Mesh(sailGeo, sailMat);
  mainSail.position.set(-0.015, 0.105, 0);
  mainSail.rotation.y = 0.12;
  group.add(mainSail);

  // Fore Mast
  const foreMast = new THREE.Mesh(mastGeo, mastMat);
  foreMast.scale.set(0.8, 0.8, 0.8);
  foreMast.position.set(0.055, 0.075, 0);
  group.add(foreMast);

  const foreSail = new THREE.Mesh(sailGeo, sailMat);
  foreSail.scale.set(0.8, 0.8, 0.8);
  foreSail.position.set(0.043, 0.085, 0);
  foreSail.rotation.y = 0.08;
  group.add(foreSail);

  return group;
};

const createVintageKraken = () => {
  const group = new THREE.Group();
  group.name = 'vintage-kraken';
  group.userData = { offset: Math.random() * 1000 };

  const skinMat = new THREE.MeshLambertMaterial({ color: 0x1f5146, flatShading: true }); // dark sea green
  const cupMat = new THREE.MeshLambertMaterial({ color: 0xe0cca7 });

  const segments = 5;
  let prevSegment = null;

  for (let i = 0; i < segments; i++) {
    const scale = 1 - (i * 0.15);
    const segGeo = new THREE.CylinderGeometry(0.018 * scale, 0.024 * scale, 0.06, 5);
    const seg = new THREE.Mesh(segGeo, skinMat);
    seg.name = 'kraken-segment';
    seg.userData = { index: i };

    if (i === 0) {
      seg.position.set(0, 0.03, 0);
      group.add(seg);
    } else {
      seg.position.set(0, 0.05, 0);
      seg.rotation.z = 0.22;
      seg.rotation.y = 0.08;
      prevSegment.add(seg);
    }

    // Suction cup
    const cup = new THREE.Mesh(new THREE.DodecahedronGeometry(0.009 * scale, 0), cupMat);
    cup.position.set(-0.014 * scale, 0, 0);
    seg.add(cup);

    prevSegment = seg;
  }

  return group;
};

const createSynthwavePyramid = () => {
  const group = new THREE.Group();
  group.name = 'synthwave-pyramid';
  group.userData = { offset: Math.random() * 1000 };

  // Neon outer wireframe pyramid
  const wireMat = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 2.2,
    wireframe: true,
    transparent: true,
    opacity: 0.78
  });
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.17, 4), wireMat);
  outer.name = 'synthwave-outer';
  outer.position.y = 0.085;
  outer.rotation.y = Math.PI / 4;
  group.add(outer);

  // Inner glowing core
  const coreMat = new THREE.MeshPhongMaterial({
    color: 0xff007f,
    emissive: 0xff007f,
    emissiveIntensity: 1.6,
    shininess: 28
  });
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 4), coreMat);
  inner.name = 'synthwave-inner';
  inner.position.y = 0.085;
  inner.rotation.y = Math.PI / 4;
  group.add(inner);

  return group;
};

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
  if (globeTheme === 'vintage') {
    return Math.random() < 0.6 ? 'ship' : 'kraken';
  } else if (globeTheme === 'synthwave') {
    return 'pyramid';
  } else if (globeTheme === 'blueprint') {
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

const getCountryLayerAltitude = (admin, foundSet, selectedCountry, extrusionScale = 1) => {
  if (admin === selectedCountry) return GLOBE_LAYER_ALTITUDE.selected * extrusionScale;
  if (foundSet.has(admin)) return GLOBE_LAYER_ALTITUDE.found * extrusionScale;
  return GLOBE_LAYER_ALTITUDE.base * extrusionScale;
};

const getDepartmentLayerAltitude = (admin, foundSet, selectedCountry) => {
  if (admin === selectedCountry) return 0.004;
  if (foundSet.has(admin)) return 0.0028;
  return 0.0018;
};

const FRESNEL_VERTEX_SHADER = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRESNEL_FRAGMENT_SHADER = `
  varying vec3 vNormal;
  uniform vec3 glowColor;
  uniform float coef;
  uniform float power;
  void main() {
    // Normalize the interpolated normal vector to ensure mathematical precision
    vec3 normal = normalize(vNormal);
    float x = clamp(abs(normal.z), 0.0, 1.0);

    // Premium atmosphere glow with smooth space blending:
    // We end the fade at 0.18 instead of 0.0 to prevent the sharp geometric sphere edge.
    // This creates an extremely soft, misty, and diffuse halo.
    float edgeFade = smoothstep(0.18, 0.55, x);

    // Dynamic power-based exponent (minimum of 2.0 to ensure zero slope at the outer boundary, avoiding sharp edges)
    float exponent = max(2.0, power * 2.2);
    float intensity = pow(edgeFade, exponent) * coef;

    gl_FragColor = vec4(glowColor, intensity);
  }
`;



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
  hasActiveFeedback,
  perfProfile,
  isHomeScreen,
  isKeyboardMode,
  isEndScreen,
  isPerfectScore,
  onPreserveInputFocus,
  globeLightingEnabled = true,
  activeDataMap,
  globeTheme = 'lowpoly'
}) => {
  const globeEl = useRef();
  const globeContentWrapperRef = useRef(null);
  const globeLightingRef = useRef(null);
  const polygonMaterialCacheRef = useRef({ cap: new Map(), side: new Map() });
  const tapRef = useRef(null);
  const previousSelectedCountryRef = useRef(null);
  const lastTargetRef = useRef(null);
  const layoutViewportRef = useRef({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const wasHomeScreenRef = useRef(isHomeScreen);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });
  const prevSelectedCountryRef = useRef(null);
  const biomeObjectsCacheRef = useRef(new Map());
  const animObjectsCacheRef = useRef([]);
  const lastAnimCacheTimeRef = useRef(0);
  const targetGlowColorRef = useRef(new THREE.Color(0x38bdf8));
  const targetGlowPowerRef = useRef(1.2);
  const targetGlowCoefRef = useRef(1.0);

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

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const now = Date.now();
    const touch = e.touches[0];
    if (now - lastTapRef.current < 300) {
      isZoomDragging.current = true;
      startY.current = touch.clientY;
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
    const newAlt = Math.max(0.1, Math.min(4, currentPOV.altitude + deltaY * zoomSpeed));
    globeEl.current.pointOfView({ altitude: newAlt }, 0);
    startY.current = touch.clientY;
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback(() => {
    isZoomDragging.current = false;
  }, []);

  useEffect(() => {
    let controlsReference = null;
    let changeHandler = null;

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
          controls.dampingFactor = perfProfile?.isMobile ? 0.08 : 0.05;
          controls.rotateSpeed = perfProfile?.isMobile ? 0.75 : 0.9;
          controls.zoomSpeed = perfProfile?.isMobile ? 0.75 : 1;
          controls.zoomToCursor = false;
          controls.minPolarAngle = ORBIT_POLE_GUARD_ANGLE;
          controls.maxPolarAngle = Math.PI - ORBIT_POLE_GUARD_ANGLE;

          // Track POV changes with a stable threshold to avoid jittery re-renders
          changeHandler = () => {
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
          controls.addEventListener('change', changeHandler);
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
      if (controlsReference && changeHandler) {
        try {
          controlsReference.removeEventListener('change', changeHandler);
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
    } else if (selectedCountry && globeEl.current) {
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
        const keyboardOcclusion = Math.max(0, window.innerHeight - viewport.height - viewport.top);
        const keyboardOffsetBoost = isKeyboardOpen
          ? Math.min(8, Math.max(0, keyboardOcclusion - 180) / 30)
          : 0;
        const baseLatOffset = isKeyboardOpen
          ? MOBILE_KEYBOARD_SELECTED_COUNTRY_LAT_OFFSET - keyboardOffsetBoost
          : (isMobile ? MOBILE_SELECTED_COUNTRY_LAT_OFFSET : 0);

        // Dynamic latOffset based on altitude and aspect ratio to prevent over-shifting on short screens or high zoom.
        // As altitude decreases (zoom in), the same angular offset results in larger pixel displacement.
        const altitudeFactor = Math.max(0.2, Math.min(1, preservedAltitude / 1.2));
        // On "short" screens (aspect > 0.7), vertical space is limited; reduce offset to keep country visible.
        const aspect = viewport.width / viewport.height;
        const aspectFactor = aspect > 0.7 ? Math.max(0.1, 1 - (aspect - 0.7) * 2.5) : 1;

        const latOffset = baseLatOffset * altitudeFactor * aspectFactor;

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
      globeEl.current.pointOfView({ altitude: viewport.width < 768 ? 2.5 : 1 }, 1000);
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
      if (!admin || gameDataMap[admin]) {
        onCountrySelect(admin);
      }
    }
  }, [gameDataMap, onCountrySelect]);

  const selectCountryAtLngLat = useCallback((lng, lat) => {
    if (mode === 'rivers_mountains') {
      let best = null;
      Object.entries(gameDataMap).forEach(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return;
        const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
        if (!best || dist < best.dist) best = { admin, dist };
      });
      selectCountry(best && best.dist < 3.5 ? best.admin : null);
      return;
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
  }, [gameDataMap, isDepartmentMode, selectableFeatureIndex, selectCountry]);

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
  const TERRAIN_COLORS = useMemo(() => LOW_POLY_TERRAIN_COLORS[theme] || LOW_POLY_TERRAIN_COLORS.dark, [theme]);
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
    const lightingMul = globeLightingEnabled ? 1.8 : 1;
    const themeMul = globeTheme === 'lowpoly' ? 1.3 : 1;
    return lightingMul * themeMul;
  }, [globeLightingEnabled, globeTheme]);

  const getRegionSurfaceColor = useCallback((region) => {
    if (globeTheme === 'lowpoly') {
      return TERRAIN_COLORS[region] || TERRAIN_COLORS.Unknown;
    }
    if (globeTheme === 'synthwave') {
      return SURFACE_THEME_COLORS.synthwave[region] || SURFACE_THEME_COLORS.synthwave.Unknown;
    }
    if (globeTheme === 'blueprint') {
      return SURFACE_THEME_COLORS.blueprint.base;
    }
    if (globeTheme === 'vintage') {
      return SURFACE_THEME_COLORS.vintage[region] || SURFACE_THEME_COLORS.vintage.Unknown;
    }
    return REGION_COLORS[region] || UI_COLORS.success;
  }, [globeTheme, REGION_COLORS, TERRAIN_COLORS, UI_COLORS.success]);

  const getPolygonColor = useCallback((d) => {
    if (isDepartmentMode) {
      const admin = getFeatureAdmin(d);
      if (d.isGhostCountry) return UI_COLORS.mapSea;
      if (isEndScreen && !foundSet.has(admin)) return UI_COLORS.error;
      if (foundSet.has(admin)) return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      if (admin === selectedCountry) return isError ? UI_COLORS.error : UI_COLORS.accent;
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
      const baseColor = globeTheme === 'lowpoly'
        ? lerpColor(getRegionSurfaceColor(region), UI_COLORS.mapBase, isLight ? 0.28 : 0.18)
        : (REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent);
      const targetColor = globeTheme === 'lowpoly'
        ? getRegionSurfaceColor(region)
        : (REGION_COLORS[region] || UI_COLORS.accent);
      // Resting selected unfound country color (slightly highlighted)
      return lerpColor(baseColor, targetColor, 0.1);
    }

    return UI_COLORS.mapBase;
  }, [selectedCountry, mode, foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, isError, isHomeScreen, isDepartmentMode, isEndScreen, isPerfectScore, getRegionSurfaceColor, globeTheme, isLight, lerpColor]);

  const getPolygonStroke = useCallback((d) => {
    if (isDepartmentMode) {
      const admin = getFeatureAdmin(d);
      if (d.isGhostCountry) return isLight
        ? lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.12)
        : lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.08);
      if (admin === selectedCountry) return isError ? UI_COLORS.error : UI_COLORS.accent;
      if (foundSet.has(admin)) return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
      return isLight ? UI_COLORS.mapBorderMuted : lerpColor(UI_COLORS.mapBase, UI_COLORS.paper, 0.18);
    }

    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';

    if (admin === selectedCountry) {
      if (isError) return UI_COLORS.error;
      const baseStroke = (isHomeScreen ? UI_COLORS.accent : getRegionSurfaceColor(region));
      return lerpColor(
        baseStroke,
        UI_COLORS.paper,
        GLOBE_STYLE.lighting.selectedStrokeGlow[isLight ? 'light' : 'dark'] + 0.06
      );
    }

    if (!foundSet.has(admin) && mode !== 'learn') {
      if (globeTheme === 'synthwave') {
        return STROKE_THEME_COLORS.synthwave.unfound;
      }
      if (globeTheme === 'blueprint') {
        return STROKE_THEME_COLORS.blueprint.unfound;
      }
      if (globeTheme === 'vintage') {
        return STROKE_THEME_COLORS.vintage.unfound;
      }
      return isLight
        ? UI_COLORS.mapBorderMuted
        : lerpColor(UI_COLORS.mapBase, UI_COLORS.paper, 0.15); // Slight glow instead of darkening
    }

    // Found / Learned / Homepage countries
    if (globeTheme === 'synthwave') {
      return region === 'Europe' || region === 'Asia' ? STROKE_THEME_COLORS.synthwave.foundEuropeAsia : STROKE_THEME_COLORS.synthwave.foundOther;
    }
    if (globeTheme === 'blueprint') {
      return STROKE_THEME_COLORS.blueprint.found;
    }
    if (globeTheme === 'vintage') {
      return STROKE_THEME_COLORS.vintage.found;
    }

    const baseColor = (foundSet.has(admin) || mode === 'learn')
      ? getRegionSurfaceColor(region)
      : UI_COLORS.mapBase;

    return lerpColor(
      baseColor,
      isLight ? UI_COLORS.ink : UI_COLORS.paper, // Use paper (white/light) for stroke in dark mode
      isLight ? GLOBE_STYLE.lighting.strokeDarken.light : 0.2 // Reduced darken for dark mode
    );
  }, [selectedCountry, UI_COLORS, isError, foundSet, mode, isHomeScreen, isLight, isDepartmentMode, lerpColor, isPerfectScore, getRegionSurfaceColor, globeTheme]);

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

        // Base color for the side when selected under lighting
        const sideBaseColor = (foundSet.has(admin) || mode === 'learn')
          ? getRegionSurfaceColor(region)
          : (globeTheme === 'lowpoly'
            ? getRegionSurfaceColor(region)
            : (REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent));

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

      const capColor = (foundSet.has(admin) || mode === 'learn')
        ? lerpColor(
          getRegionSurfaceColor(region),
          UI_COLORS.paper,
          0.1 * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        )
        : lerpColor(
          globeTheme === 'lowpoly'
            ? lerpColor(getRegionSurfaceColor(region), UI_COLORS.mapBase, isLight ? 0.28 : 0.18)
            : (REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent),
          globeTheme === 'lowpoly'
            ? getRegionSurfaceColor(region)
            : (REGION_COLORS[region] || UI_COLORS.accent),
          0.1
        );

      return lerpColor(capColor, UI_COLORS.black, isLight ? 0.24 : 0.08);
    }

    return lerpColor(baseColor, UI_COLORS.black, isLight ? 0.32 : 0.16);
  }, [foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, selectedCountry, isLight, globeLightingEnabled, mode, isHomeScreen, isDepartmentMode, lerpColor, getPolygonColor, getRegionSurfaceColor, globeTheme]);

  const getPolygonMaterial = useCallback((d, kind) => {
    const admin = getFeatureAdmin(d) || 'unknown';
    const cache = polygonMaterialCacheRef.current[kind];
    const color = kind === 'cap' ? getPolygonColor(d) : getPolygonSideColor(d);
    let material = cache.get(admin);

    const ExpectedMaterialClass = perfProfile?.isMobile ? THREE.MeshLambertMaterial : THREE.MeshPhongMaterial;
    const isCorrectClass = perfProfile?.isMobile
      ? material && material.isMeshLambertMaterial
      : material && material.isMeshPhongMaterial;

    if (material && !isCorrectClass) {
      material.dispose();
      cache.delete(admin);
      material = null;
    }

    if (!material) {
      material = new ExpectedMaterialClass({
        side: THREE.DoubleSide, // Ensure sides are visible from all angles
        blending: THREE.NormalBlending,
        depthWrite: true // Re-enable depthWrite for solid volume feel
      });
      cache.set(admin, material);
    }

    material.color.set(color);

    // DepthWrite is critical for visibility over the globe sphere
    if (material.depthWrite !== true) {
      material.depthWrite = true;
    }

    // Set polygonOffset to false to eliminate holes and gaps perfectly
    const targetPolygonOffset = (isDepartmentMode && d.isGhostCountry);
    if (material.polygonOffset !== targetPolygonOffset) {
      material.polygonOffset = targetPolygonOffset;
      if (targetPolygonOffset) {
        material.polygonOffsetFactor = 1.5;
        material.polygonOffsetUnits = 1.5;
      }
      material.needsUpdate = true;
    }

    // Handle flat shading for the low-poly theme
    const targetFlatShading = (globeTheme === 'lowpoly');
    if (material.flatShading !== targetFlatShading) {
      material.flatShading = targetFlatShading;
      material.needsUpdate = true;
    }

    // Handle wireframe/opacity for the hologram blueprint theme
    const isFound = foundSet.has(admin) || mode === 'learn';
    let targetWireframe = false;
    let targetOpacity = 1;
    let targetTransparent = false;

    if (globeTheme === 'blueprint') {
      targetWireframe = !isFound && admin !== selectedCountry;
      targetOpacity = isFound || admin === selectedCountry ? 0.45 : 0.15;
      targetTransparent = true;
    }

    if (material.wireframe !== targetWireframe || material.transparent !== targetTransparent) {
      material.wireframe = targetWireframe;
      material.transparent = targetTransparent;
      material.needsUpdate = true;
    }
    if (material.opacity !== targetOpacity) {
      material.opacity = targetOpacity;
    }

    if (isDepartmentMode && d.isGhostCountry) {
      if (material.isMeshPhongMaterial) {
        material.specular.set(globeLightingEnabled ? UI_COLORS.globeSpecular : UI_COLORS.ink);
        material.emissive.set(globeLightingEnabled ? UI_COLORS.globeEmissive : UI_COLORS.black);
        material.emissiveIntensity = globeLightingEnabled ? (isLight ? 0.1 : 0.2) : 0;
        material.shininess = globeLightingEnabled ? (isLight ? 4 : 8) : 0.7;
      } else {
        material.emissive.set(globeLightingEnabled ? UI_COLORS.globeEmissive : UI_COLORS.black);
        material.emissiveIntensity = globeLightingEnabled ? (isLight ? 0.1 : 0.2) : 0;
      }
      return material;
    }

    if (isDepartmentMode) {
      if (material.isMeshPhongMaterial) {
        material.specular.set(UI_COLORS.mapBorder);
        material.emissive.set(color);
        material.emissiveIntensity = kind === 'cap' ? (isLight ? 0.08 : 0.12) : (isLight ? 0.04 : 0.07);
        material.shininess = kind === 'cap' ? 2 : 1;
      } else {
        material.emissive.set(color);
        material.emissiveIntensity = kind === 'cap' ? (isLight ? 0.08 : 0.12) : (isLight ? 0.04 : 0.07);
      }
      return material;
    }

    if (globeLightingEnabled) {
      material.emissive.set(color);

      const baseEmissiveIntensity = (kind === 'cap'
        ? (isLight ? GLOBE_STYLE.lighting.material.capEmissiveLight : GLOBE_STYLE.lighting.material.capEmissiveDark)
        : (isLight ? GLOBE_STYLE.lighting.material.sideEmissiveLight : GLOBE_STYLE.lighting.material.sideEmissiveDark));

      // Glass/Neon effect: boost emissive in dark mode or synthwave theme
      const emissiveBoost = globeTheme === 'synthwave'
        ? (admin === selectedCountry ? 0.35 : 0.22)
        : globeTheme === 'lowpoly'
          ? (admin === selectedCountry ? 0.12 : 0.02)
          : (!isLight ? 0.18 : 0.05);

      material.emissiveIntensity = baseEmissiveIntensity + emissiveBoost + (
        admin === selectedCountry ? 0.1 : 0
      );

      if (material.isMeshPhongMaterial) {
        material.specular.set(admin === selectedCountry ? UI_COLORS.paper : UI_COLORS.mapBorder);
        const baseShininess = (kind === 'cap'
          ? (isLight ? GLOBE_STYLE.lighting.material.capShininessLight : GLOBE_STYLE.lighting.material.capShininessDark)
          : (isLight ? GLOBE_STYLE.lighting.material.sideShininessLight : GLOBE_STYLE.lighting.material.sideShininessDark));

        // Polished premium shine for selected country, matte for vintage
        material.shininess = globeTheme === 'vintage' ? 0 : (baseShininess + (admin === selectedCountry ? 30 : (isLight ? 0 : 25)));
        if (globeTheme === 'vintage') {
          material.specular.set(0x000000);
        }
      }
    } else {
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
      if (material.isMeshPhongMaterial) {
        material.shininess = 0.7;
      }
    }

    return material;
  }, [getPolygonColor, getPolygonSideColor, isLight, globeLightingEnabled, UI_COLORS, selectedCountry, isDepartmentMode, foundSet, globeTheme, mode, perfProfile]);

  const getPolygonCapMaterial = useCallback((d) => (
    getPolygonMaterial(d, 'cap')
  ), [getPolygonMaterial]);

  const getPolygonSideMaterial = useCallback((d) => (
    getPolygonMaterial(d, 'side')
  ), [getPolygonMaterial]);

  useEffect(() => {
    const materialCache = polygonMaterialCacheRef.current;
    return () => {
      materialCache.cap.forEach(material => material.dispose());
      materialCache.side.forEach(material => material.dispose());
      materialCache.cap.clear();
      materialCache.side.clear();
    };
  }, []);

  const getPolygonAltitude = useCallback((d) => {
    if (mode === 'rivers_mountains') return 0.0005;
    if (isDepartmentMode && d.isGhostCountry) return 0.003;
    const admin = getFeatureAdmin(d);
    if (isDepartmentMode) {
      return getDepartmentLayerAltitude(admin, foundSet, selectedCountry) * (admin === selectedCountry ? 1.03 : 1);
    }
    const altitude = getCountryLayerAltitude(admin, foundSet, selectedCountry, extrusionScale);
    if (admin === selectedCountry) return altitude * 1.05;
    return altitude;
  }, [extrusionScale, selectedCountry, foundSet, isDepartmentMode, mode]);

  const getSelectionEffectAltitude = useCallback(() => {
    if (isDepartmentMode) {
      return getDepartmentLayerAltitude(selectedCountry, foundSet, selectedCountry) + 0.0006;
    }
    const selectedAltitude = GLOBE_LAYER_ALTITUDE.selected * extrusionScale;
    return selectedAltitude * 1.05 + 0.004;
  }, [extrusionScale, isDepartmentMode, foundSet, selectedCountry]);

  const getHtmlAltitude = useCallback((d) => {
    if (isDepartmentMode) {
      return getDepartmentLayerAltitude(d.admin, foundSet, selectedCountry) + 0.00025;
    }
    return getCountryLayerAltitude(
      d.admin,
      foundSet,
      selectedCountry,
      extrusionScale
    ) + 0.002;
  }, [foundSet, extrusionScale, isDepartmentMode, selectedCountry]);

  const getPolygonStrokeWidth = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    if (isDepartmentMode && d.isGhostCountry) {
      return perfProfile?.isMobile ? 0.045 : 0.06;
    }
    // Increased thickness for selection
    if (admin === selectedCountry) return perfProfile?.isMobile ? 2.1 : 3.0;
    // Low-poly theme: no flat 2D strokes — let 3D facets define the shape
    if (globeTheme === 'lowpoly') return 0;
    if (isDepartmentMode) return perfProfile?.isMobile ? 0.55 : 0.75;
    if (isLight || globeLightingEnabled) return perfProfile?.isMobile ? 0.45 : 0.65;
    return perfProfile?.isMobile ? 0.25 : 0.4;
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

    const labelDataMap = isDepartmentMode ? gameDataMap : countryDataMap;
    const keysToShow = isDepartmentMode
      ? foundList
      : ((mode === 'learn' || isHomeScreen || isEndScreen) ? Object.keys(labelDataMap) : foundList);
    const pov = cameraPOV;

    const filtered = keysToShow
      .map(adminKey => {
        const data = labelDataMap[adminKey];
        if (!data) return null;

        const isSelected = adminKey === selectedCountry;
        const isFound = foundSet.has(adminKey);
        const size = countrySizes[adminKey] || 0.5;

        // Visibility based on zoom level
        const visibilityThreshold = isDepartmentMode
          ? 1.05
          : (isSelected ? 10 : (isHomeScreen ? 1.8 : Math.min(3.0, 0.8 + size * 2.0)));

        if (zoomLevel > visibilityThreshold) return null;

        let dLng = Math.abs(data.lng - pov.lng);
        if (dLng > 180) dLng = 360 - dLng;
        const distToCenter = Math.hypot(dLng, data.lat - pov.lat);

        if (!isSelected && distToCenter > (isDepartmentMode ? 7 : 95)) return null;

        // Use cached object if available to maintain reference stability
        const cached = labelsCacheRef.current[adminKey];
        if (cached && cached.isSelected === isSelected && cached.lang === lang && cached.isFound === isFound && cached.mode === mode) {
           cached.distToCenter = distToCenter; // Update distance for sorting without changing reference
           return cached;
        }

        const newLabel = {
          admin: adminKey,
          lat: data.lat,
          lng: data.lng,
          country: lang === 'fr' ? (data.name_fr || adminKey) : (data.name_en || adminKey),
          capital: lang === 'fr' ? (data.capital_fr || data.capital) : data.capital,
          region: data.region,
          flag: getFlagEmoji(data.iso2),
          code: data.code,
          size,
          distToCenter,
          isSelected,
          isFound,
          mode,
          lang // Store lang to invalidate cache if it changes
        };
        labelsCacheRef.current[adminKey] = newLabel;
        return newLabel;
      })
      .filter(d => d !== null)
      .sort((a, b) => {
        if (a.isSelected) return -1;
        if (b.isSelected) return 1;
        return a.distToCenter - b.distToCenter;
      });

    if (isDepartmentMode) return filtered.slice(0, perfProfile?.isMobile ? 10 : 18);
    return perfProfile?.maxLabels ? filtered.slice(0, perfProfile.maxLabels) : filtered;
  }, [foundList, countrySizes, zoomLevel, cameraPOV, lang, perfProfile?.maxLabels, mode, selectedCountry, isHomeScreen, isDepartmentMode, gameDataMap, foundSet]);

  const createLabelElement = useCallback((d) => {
    const el = document.createElement('div');
    const color = isDepartmentMode
      ? (d.isFound ? UI_COLORS.success : (d.isSelected ? UI_COLORS.accent : UI_COLORS.textMuted))
      : (isHomeScreen ? UI_COLORS.textMuted : (REGION_COLORS_LABELS[d.region] || UI_COLORS.warning));

    // Set root to 0 size so its center is the exact lat/lng
    el.style.width = '0';
    el.style.height = '0';
    el.style.position = 'relative';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';

    el.innerHTML = isDepartmentMode ? `
      <div
        class="globe-label-element department-label-element"
        style="
          position: relative;
          width: 0;
          height: 0;
          --department-label-accent: ${color};
          --department-label-bg: ${UI_COLORS.departmentLabelBg};
          --department-label-text: ${UI_COLORS.textMain};
          --department-label-subtle-text: ${UI_COLORS.textMuted};
          --department-label-border: ${UI_COLORS.departmentLabelBorder};
          --department-label-code-text: ${UI_COLORS.textInverse};
          --department-label-dot-shadow: ${UI_COLORS.departmentLabelDotShadow};
          --department-label-shadow: ${UI_COLORS.departmentLabelShadow};
          --department-label-inset-shadow: ${UI_COLORS.departmentLabelInsetShadow};
        "
      >
        <div class="department-label-dot"></div>
        <div class="department-label-copy">
          <div class="department-label-main">
            <span class="department-label-code">${d.code}</span>
            <span class="department-label-name">${d.country}</span>
          </div>
          <div class="department-label-capital">(${d.capital})</div>
        </div>
      </div>
    ` : `
      <div class="globe-label-element" style="position: relative; width: 0; height: 0;">
        <div style="
          position: absolute;
          width: 6px;
          height: 6px;
          background: ${color};
          border-radius: 50%;
          left: -3px;
          top: -3px;
          opacity: ${isHomeScreen ? 0.5 : 1};
        "></div>
        <div style="
          position: absolute;
          left: 8px;
          top: 0;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          font-family: var(--font-main);
          white-space: nowrap;
        ">
          <div style="
            color: ${color};
            font-weight: 600;
            font-size: 13px;
            line-height: 1.2;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>${d.flag}</span>
            <span>${d.country}</span>
          </div>
          <div style="
            color: ${color};
            font-weight: 400;
            font-size: 11px;
            line-height: 1.2;
            opacity: 0.7;
          ">(${d.capital})</div>
        </div>
      </div>
    `;
    return el;
  }, [REGION_COLORS_LABELS, UI_COLORS, isHomeScreen, isDepartmentMode]);

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

  const getBiomeAssetsData = useMemo(() => {
    if (mode === 'rivers_mountains') {
      const assets = [];
      Object.keys(gameDataMap).forEach(k => {
        const data = gameDataMap[k];
        if (!data || data.lat === undefined) return;
        const isFound = foundSet.has(k) || mode === 'learn' || isHomeScreen;
        assets.push({
          admin: k,
          lat: data.lat,
          lng: data.lng,
          isFound,
          type: data.type,
          scale: data.type === 'mountain' ? 1.0 : 0.8,
          rotation: 0
        });
      });
      return assets;
    }

    if (isDepartmentMode || globeTheme === 'glass') return [];

    const assets = [];
    const allAdmins = Object.keys(gameDataMap);

    allAdmins.forEach(admin => {
      const data = gameDataMap[admin];
      if (!data || data.lat === undefined) return;

      const isFound = foundSet.has(admin) || mode === 'learn';
      if (!isFound) return;

      const size = countrySizes[admin] || 1;
      const maxModels = globeTheme === 'lowpoly' ? getBiomeModelCount(size, isDepartmentMode) : 1;

      if (!biomePointsCacheRef.current[admin]) {
        biomePointsCacheRef.current[admin] = {};
      }

      if (!biomePointsCacheRef.current[admin][globeTheme]) {
        const generated = [];
        const featureEntry = selectableFeatureIndex.find(entry => entry.admin === admin);

        let biomeType = data.region || 'Unknown';
        if (admin === 'France' || isDepartmentMode) {
          biomeType = 'France';
        } else if (admin === 'United States of America') {
          biomeType = 'USA';
        }

        if (featureEntry && featureEntry.polygons.length > 0) {
          for (let i = 0; i < maxModels; i++) {
            const point = getSampledBiomePoint(featureEntry, data, size, generated);
            const variant = selectLogicalBiomeVariant(point.lat, point.lng, biomeType, data.lat, data.lng, globeTheme);

            generated.push({
              admin,
              lat: point.lat,
              lng: point.lng,
              biomeType,
              variant,
              scale: globeTheme === 'lowpoly' ? (0.7 + Math.random() * 1.05) : 1.0,
              rotation: Math.random() * 360
            });
          }
        } else {
          for (let i = 0; i < maxModels; i++) {
            const point = getBiomeFallbackPoint(data, size);
            const variant = selectLogicalBiomeVariant(point.lat, point.lng, biomeType, data.lat, data.lng, globeTheme);

            generated.push({
              admin,
              lat: point.lat,
              lng: point.lng,
              biomeType,
              variant,
              scale: globeTheme === 'lowpoly' ? (0.75 + Math.random() * 0.9) : 1.0,
              rotation: Math.random() * 360
            });
          }
        }
        biomePointsCacheRef.current[admin][globeTheme] = generated;
      }

      const cached = biomePointsCacheRef.current[admin][globeTheme];
      for (let i = 0; i < cached.length; i++) {
        assets.push({ ...cached[i], isFound });
      }
    });

    return assets;
  }, [globeTheme, foundList, gameDataMap, countrySizes, selectableFeatureIndex, isDepartmentMode, isHomeScreen, mode, foundSet, perfProfile]);

  const getBiomeAltitude = useCallback((d) => {
    const admin = d.admin;
    if (mode === 'rivers_mountains') {
      return admin === selectedCountry ? 0.006 : 0.0015;
    }
    if (globeTheme === 'vintage') {
      return 0.0012; // Vintage assets float exactly at sea level
    }
    if (isDepartmentMode) {
      const alt = getDepartmentLayerAltitude(admin, foundSet, selectedCountry);
      return admin === selectedCountry ? alt * 1.03 + 0.0005 : alt + 0.0005;
    }
    const altitude = getCountryLayerAltitude(admin, foundSet, selectedCountry, extrusionScale);
    if (admin === selectedCountry) {
      return altitude * 1.05 + 0.0015; // Slightly above cap to prevent clipping
    }
    return altitude + 0.0015;
  }, [extrusionScale, selectedCountry, foundSet, isDepartmentMode, globeTheme]);

  const createBiomeThreeObject = useCallback((d) => {
    const key = `${d.admin || 'unknown'}_${d.isFound ? 'found' : 'unfound'}_${d.scale}_${d.lat}_${d.lng}_${globeTheme}`;
    if (biomeObjectsCacheRef.current.has(key)) {
      return biomeObjectsCacheRef.current.get(key);
    }

    let asset;
    if (mode === 'rivers_mountains') {
      if (!d.isFound) {
        asset = createUnfoundPlaceholder(d.type, theme);
      } else {
        if (d.type === 'mountain') {
          asset = createMountainFeature(theme);
        } else {
          asset = createRiverFeature(theme);
        }
      }
    } else if (globeTheme === 'vintage') {
      if (d.variant === 'ship') {
        asset = createVintageShip();
      } else {
        asset = createVintageKraken();
      }
    } else if (globeTheme === 'synthwave') {
      asset = createSynthwavePyramid();
    } else if (globeTheme === 'blueprint') {
      asset = createBlueprintNode();
    } else {
      asset = createBiomeAsset(d.biomeType, theme, d.variant);
    }

    const alignedAsset = new THREE.Group();
    asset.rotation.x = BIOME_SURFACE_ALIGNMENT_RADIANS;
    alignedAsset.add(asset);

    const baseScale = d.scale * BIOME_SCENE_SCALE;
    // Unfound countries get smaller preview biomes, but on home screen they are all fully shown!
    alignedAsset.scale.setScalar(d.isFound ? baseScale : baseScale * 0.5);

    biomeObjectsCacheRef.current.set(key, alignedAsset);
    return alignedAsset;
  }, [theme, globeTheme]);

  useEffect(() => {
    // Clear biome objects cache when theme changes to prevent memory leak and release old theme assets
    biomeObjectsCacheRef.current.clear();
  }, [globeTheme]);

  const ringsData = useMemo(() => {
    if (selectedCountry) {
      const mapped = gameDataMap[selectedCountry];
      const region = mapped?.region || 'Unknown';
      if (mapped && mapped.lat !== undefined) {
        const baseColor = isError
          ? UI_COLORS.error
          : (REGION_COLORS_LABELS[region] || REGION_COLORS[region] || UI_COLORS.accent);
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
        return [
          {
            lat: mapped.lat,
            lng: mapped.lng,
            color: baseColor,
            maxRadius: perfProfile?.isMobile ? 1.0 : 1.35,
            speed: perfProfile?.isMobile ? 0.35 : 0.5,
            repeat: perfProfile?.isMobile ? 2400 : 2000
          },
          {
            lat: mapped.lat,
            lng: mapped.lng,
            color: softColor,
            maxRadius: perfProfile?.isMobile ? 0.52 : 0.72,
            speed: perfProfile?.isMobile ? 0.22 : 0.32,
            repeat: perfProfile?.isMobile ? 1700 : 1450
          }
        ];
      }
    }
    return [];
  }, [gameDataMap, isDepartmentMode, isError, isLight, perfProfile?.isMobile, REGION_COLORS, REGION_COLORS_LABELS, selectedCountry, UI_COLORS]);

  const customGlobeTexture = useMemo(() => {
    if (globeTheme === 'vintage') {
      return createVintageParchmentTexture();
    }
    if (globeTheme === 'synthwave') {
      return createSynthwaveGridTexture();
    }
    if (globeTheme === 'blueprint') {
      return createBlueprintGridTexture();
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
    if (globeTheme === 'vintage') {
      return new THREE.MeshPhongMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        specular: 0x111111,
        shininess: 2,
        flatShading: false
      });
    }
    if (globeTheme === 'synthwave') {
      return new THREE.MeshPhongMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        specular: 0x555555,
        shininess: 30,
        emissive: 0x110022,
        emissiveIntensity: 0.8
      });
    }
    if (globeTheme === 'blueprint') {
      return new THREE.MeshPhongMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        specular: 0x2288ff,
        shininess: 15
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
      if (globeLightingRef.current?.group?.parent) {
        globeLightingRef.current.group.parent.remove(globeLightingRef.current.group);
      }
      globeLightingRef.current?.innerGlow?.geometry?.dispose();
      globeLightingRef.current?.innerGlow?.material?.dispose();
      globeLightingRef.current = null;
      return true;
    }

    if (!globeLightingRef.current) {
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
        new THREE.SphereGeometry(120.0, 64, 64),
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

      group.add(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight, innerGlow);
      scene.add(group);
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
      const initialHex = globeTheme === 'synthwave' ? 0xff007f : (globeTheme === 'blueprint' ? 0x00ffff : (globeTheme === 'vintage' ? 0xd4a373 : 0x38bdf8));
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

    if (isMobile) {
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
    rimLight.color.set(UI_COLORS.lightingRim);
    fillLight.color.set(UI_COLORS.lightingFill);
    fillLight.groundColor.set(UI_COLORS.lightingGround);
    studioLight.color.set(UI_COLORS.lightingStudio);
    studioLeft.color.set(UI_COLORS.lightingLeft);
    studioRight.color.set(UI_COLORS.lightingRight);

    let glowColorHex = 0x64b5f6;
    let glowPower = 1.2;
    let glowCoef = 1.0;

    if (selectedCountry && activeDataMap && activeDataMap[selectedCountry]) {
      const region = activeDataMap[selectedCountry].region;
      const rColor = getThemeRegionColor(globeTheme, theme, region);
      if (rColor) {
        glowColorHex = parseInt(rColor.replace('#', '0x'), 16);
      }
    } else {
      if (globeTheme === 'synthwave') {
        glowColorHex = 0xff007f;
        glowPower = 1.0;
        glowCoef = 1.0;
      } else if (globeTheme === 'blueprint') {
        glowColorHex = 0x00ffff;
        glowPower = 1.2;
        glowCoef = 1.0;
      } else if (globeTheme === 'vintage') {
        glowColorHex = 0xd4a373;
        glowPower = 1.1;
        glowCoef = 1.0;
      } else if (globeTheme === 'lowpoly') {
        glowColorHex = 0x38bdf8;
        glowPower = 1.2;
        glowCoef = 1.0;
      }
    }

    // Update target refs instead of direct uniform changes to enable smooth lerped transition in animateScene
    targetGlowColorRef.current.setHex(glowColorHex);
    targetGlowPowerRef.current = glowPower;
    targetGlowCoefRef.current = glowCoef;

    return true;
  }, [isLight, globeLightingEnabled, UI_COLORS, perfProfile?.isMobile, globeTheme, selectedCountry, activeDataMap, REGION_COLORS]);

  useEffect(() => {
    updateGlobeLighting();

    return () => {
      if (globeLightingRef.current?.group?.parent) {
        globeLightingRef.current.group.parent.remove(globeLightingRef.current.group);
      }
      globeLightingRef.current?.innerGlow?.geometry?.dispose();
      globeLightingRef.current?.innerGlow?.material?.dispose();
      globeLightingRef.current = null;
    };
  }, [updateGlobeLighting]);



  const styleGlobeGraticules = useCallback(() => {
    const scene = globeEl.current?.scene?.();
    if (!scene) return;

    let graticuleColor = getOpaqueThreeColor(UI_COLORS.graticule);
    let graticuleOpacity = isLight
      ? GLOBE_STYLE.lighting.graticuleOpacity.light
      : GLOBE_STYLE.lighting.graticuleOpacity.dark;

    if (globeTheme === 'synthwave') {
      graticuleColor = new THREE.Color(0xff007f);
      graticuleOpacity = 0.45;
    } else if (globeTheme === 'blueprint') {
      graticuleColor = new THREE.Color(0x00ffff);
      graticuleOpacity = 0.45;
    } else if (globeTheme === 'vintage') {
      graticuleColor = new THREE.Color(0x8b5a2b);
      graticuleOpacity = 0.18;
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
    // Style graticules and lighting exactly once when theme or UI colors change
    styleGlobeGraticules();
    updateGlobeLighting();

    let animFrameId;
    const animateScene = () => {
      const scene = globeEl.current?.scene?.();
      if (!scene) {
        animFrameId = requestAnimationFrame(animateScene);
        return;
      }

      const time = performance.now();

      // Update/rebuild the animObjectsCache every 1000ms
      if (time - lastAnimCacheTimeRef.current > 1000) {
        const animList = [];
        scene.traverse((obj) => {
          if (
            obj.name === 'vintage-ship' ||
            obj.name === 'kraken-segment' ||
            obj.name === 'synthwave-outer' ||
            obj.name === 'synthwave-inner' ||
            obj.name === 'blueprint-cone' ||
            obj.name === 'blueprint-ring'
          ) {
            animList.push(obj);
          }
        });
        animObjectsCacheRef.current = animList;
        lastAnimCacheTimeRef.current = time;
      }

      // Loop through cached animated custom objects instead of scene traversal (0ms traversal overhead)
      const animList = animObjectsCacheRef.current;
      for (let i = 0; i < animList.length; i++) {
        const obj = animList[i];

        // Sway ships
        if (obj.name === 'vintage-ship') {
          const offset = obj.userData?.offset || 0;
          const shipTime = time + offset;
          obj.rotation.z = Math.sin(shipTime * 0.002) * 0.04;
          obj.rotation.x = Math.PI / 2 + Math.cos(shipTime * 0.0015) * 0.03;
          obj.position.y = Math.sin(shipTime * 0.003) * 0.005;
        }

        // Ripple kraken tentacles
        else if (obj.name === 'kraken-segment') {
          const depth = obj.userData?.index || 0;
          let root = obj.parent;
          while (root && root.name !== 'vintage-kraken') {
            root = root.parent;
          }
          const offset = root?.userData?.offset || 0;
          const krakenTime = time + offset;

          obj.rotation.z = 0.18 + Math.sin(krakenTime * 0.0025 + depth * 0.8) * 0.08;
          obj.rotation.y = 0.06 + Math.cos(krakenTime * 0.0018 + depth * 0.6) * 0.05;
        }

        // Spin synthwave pyramids
        else if (obj.name === 'synthwave-outer') {
          const offset = obj.parent?.userData?.offset || 0;
          const pTime = time + offset;
          obj.rotation.y = pTime * 0.0008;
          obj.position.y = 0.085 + Math.sin(pTime * 0.002) * 0.012;
        }
        else if (obj.name === 'synthwave-inner') {
          const offset = obj.parent?.userData?.offset || 0;
          const pTime = time + offset;
          obj.rotation.y = -pTime * 0.0014;
          obj.position.y = 0.085 + Math.sin(pTime * 0.002) * 0.012;
        }

        // Pulse blueprint beacons
        else if (obj.name === 'blueprint-cone') {
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

      // Smoothly transition the custom globe atmosphere glow towards target values
      const lighting = globeLightingRef.current;
      if (lighting?.innerGlow?.material?.uniforms) {
        const uniforms = lighting.innerGlow.material.uniforms;
        uniforms.glowColor.value.lerp(targetGlowColorRef.current, 0.08);
        uniforms.power.value += (targetGlowPowerRef.current - uniforms.power.value) * 0.08;
        uniforms.coef.value += (targetGlowCoefRef.current - uniforms.coef.value) * 0.08;
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
              const emissiveBoost = globeTheme === 'synthwave'
                ? 0.22
                : globeTheme === 'lowpoly'
                  ? 0.02
                  : (!isLight ? 0.18 : 0.05);
              mat.emissiveIntensity = baseEmissiveIntensity + emissiveBoost;
            } else {
              if (mat.userData.originalColor) {
                mat.color.copy(mat.userData.originalColor);
              }
            }
          });
        }
        prevSelectedCountryRef.current = selectedCountry;
      }

      if (selectedCountry) {
        const pulseVal = Math.sin((time / 2400) * Math.PI * 2) * 0.5 + 0.5;
        const capMat = polygonMaterialCacheRef.current.cap.get(selectedCountry);
        const sideMat = polygonMaterialCacheRef.current.side.get(selectedCountry);

        [capMat, sideMat].forEach((mat, index) => {
          if (!mat) return;
          const isCap = index === 0;

          if (globeLightingEnabled) {
            const baseEmissiveIntensity = (isCap
              ? (isLight ? GLOBE_STYLE.lighting.material.capEmissiveLight : GLOBE_STYLE.lighting.material.capEmissiveDark)
              : (isLight ? GLOBE_STYLE.lighting.material.sideEmissiveLight : GLOBE_STYLE.lighting.material.sideEmissiveDark));

            const emissiveBoost = globeTheme === 'synthwave'
              ? 0.35
              : globeTheme === 'lowpoly'
                ? 0.12
                : (!isLight ? 0.18 : 0.05);

            mat.emissiveIntensity = baseEmissiveIntensity + emissiveBoost + 0.1 + (pulseVal * 0.15);
          } else {
            if (!mat.userData.originalColor) {
              mat.userData.originalColor = mat.color.clone();
            }
            const paperColor = new THREE.Color(UI_COLORS.paper);
            const lerped = mat.userData.originalColor.clone();
            lerped.lerp(paperColor, pulseVal * 0.15);
            mat.color.copy(lerped);
          }
        });
      }

      animFrameId = requestAnimationFrame(animateScene);
    };

    animFrameId = requestAnimationFrame(animateScene);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [globeTheme, isLight, UI_COLORS, styleGlobeGraticules, updateGlobeLighting, selectedCountry, globeLightingEnabled]);

  const handleGlobeReady = useCallback(() => {
    styleGlobeGraticules();
    updateGlobeLighting();
  }, [styleGlobeGraticules, updateGlobeLighting]);

  const isMobileKeyboardOpen = viewport.width < 1024 && isKeyboardMode;
  if (!isMobileKeyboardOpen) {
    layoutViewportRef.current = {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
  const globeWidth = isMobileKeyboardOpen ? viewport.width : layoutViewportRef.current.width;
  const globeHeight = isMobileKeyboardOpen ? viewport.height : layoutViewportRef.current.height;
  const homeGlobeOffset = isHomeScreen && !isMobileKeyboardOpen && globeWidth >= 769
    ? Math.round(globeWidth * 0.18)
    : 0;
  const globeRenderWidth = globeWidth + (homeGlobeOffset * 2);

  const countriesWithGeometry = useMemo(() => {
    return new Set(renderCountriesData.map(getFeatureAdmin));
  }, [renderCountriesData]);

  const tinyCountries = useMemo(() => {
    // Countries that HAVE geometry but it's too small to see/tap easily (< 0.5 deg)
    return new Set(
      selectableFeatureIndex
        .filter(entry => {
          const b = entry.bounds;
          return (b.maxLng - b.minLng < 0.5) && (b.maxLat - b.minLat < 0.5);
        })
        .map(entry => entry.admin)
    );
  }, [selectableFeatureIndex]);

  const markersData = useMemo(() => {
    if (isDepartmentMode || mode === 'rivers_mountains') return [];

    return Object.entries(countryDataMap)
      .filter(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return false;
        // Marker if: No geometry OR Tiny geometry
        return !countriesWithGeometry.has(admin) || tinyCountries.has(admin);
      })
      .map(([admin, data]) => ({
        admin,
        lat: data.lat,
        lng: data.lng,
        region: data.region
      }));
  }, [countriesWithGeometry, tinyCountries, isDepartmentMode, gameDataMap, mode]);

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
      const baseColor = globeTheme === 'lowpoly'
        ? lerpColor(getRegionSurfaceColor(region), UI_COLORS.mapBase, isLight ? 0.28 : 0.18)
        : (REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent);
      const targetColor = globeTheme === 'lowpoly'
        ? getRegionSurfaceColor(region)
        : (REGION_COLORS[region] || UI_COLORS.accent);
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
    return getCountryLayerAltitude(d.admin, foundSet, selectedCountry, extrusionScale);
  }, [foundSet, selectedCountry, extrusionScale]);


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

  const effectiveResolution = useMemo(() => {
    return perfProfile?.polygonCapCurvatureResolution ?? 1.5;
  }, [perfProfile]);

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
        : (globeTheme === 'synthwave'
          ? ATMOSPHERE_THEME_COLORS.synthwave
          : globeTheme === 'blueprint'
          ? ATMOSPHERE_THEME_COLORS.blueprint
          : globeTheme === 'vintage'
          ? ATMOSPHERE_THEME_COLORS.vintage
          : globeTheme === 'lowpoly'
          ? ATMOSPHERE_THEME_COLORS.lowpoly
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
        top: isMobileKeyboardOpen ? viewport.top : 0,
        left: isMobileKeyboardOpen ? viewport.left : 0,
        width: globeWidth,
        height: globeHeight,
        zIndex: 0,
        overflow: 'hidden',
        transition: 'top var(--transition-layout), left var(--transition-layout), width var(--transition-layout), height var(--transition-layout)',
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

           {/* Glow Effects (Blue/Purple accents) */}
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
          {globeLightingEnabled && (
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
            showAtmosphere={!!perfProfile?.showAtmosphere}
            atmosphereColor={activeAtmosphereColor}
            atmosphereDayQuotient={isLight ? 0.2 : 0.1}
            onGlobeReady={handleGlobeReady}
            backgroundColor={GLOBE_TRANSPARENT_BACKGROUND}
            lineHoverPrecision={0}
            showGraticules={true}
            rendererConfig={{ antialias: perfProfile?.antialias !== false, logarithmicDepthBuffer: false, powerPreference: "high-performance" }}
            animateIn={false}
            enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
            polygonsData={visibleRenderCountriesData}
            polygonGeoJsonGeometry="renderGeometry"
            polygonCapCurvatureResolution={effectiveResolution}
            polygonAltitude={getPolygonAltitude}
            polygonCapColor={getPolygonCapColorWrapped}
            polygonCapMaterial={globeLightingEnabled ? getPolygonCapMaterial : undefined}
            polygonSideColor={getPolygonSideColorWrapped}
            polygonSideMaterial={globeLightingEnabled ? getPolygonSideMaterial : undefined}
            polygonStrokeColor={getPolygonStrokeColorWrapped}
            polygonStrokeWidth={getPolygonStrokeWidth}
            polygonAltitudeUpdateMs={50}
            polygonsTransitionDuration={SELECTION_TRANSITION_DURATION}
            pointsData={visibleMarkersData}
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
            onObjectClick={(obj) => {
              if (!isHomeScreen) {
                selectCountry(obj.admin);
              }
            }}
            onBackgroundClick={handleBackgroundClick}
          />
        </div>
    </div>
  );
};

export default React.memo(GlobeMap);
