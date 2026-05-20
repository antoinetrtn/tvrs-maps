import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';
import { THEME, CONTINENT_COLORS, CONTINENT_COLORS_ATTENUATED, CONTINENT_COLORS_LABELS, GLOBE_STYLE } from './designSystem';
import { createBiomeAsset, disposeBiomeCache } from './LowPolyBiomes';


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
  globeTheme = 'glass'
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
  const [pulse, setPulse] = useState(0);
  const labelsCacheRef = useRef({});
  const isDepartmentMode = mode === 'departments' && !isHomeScreen;
  const gameDataMap = isDepartmentMode ? (activeDataMap || {}) : countryDataMap;

  // Pulse animation loop for selection
  useEffect(() => {
    let animationId;
    let start;
    let lastFrame = 0;
    const animate = (time) => {
      if (!start) start = time;
      if (time - lastFrame < 33) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastFrame = time;
      const progress = (time - start) / 2400; // Slower 2.4s cycle
      setPulse(Math.sin(progress * Math.PI * 2) * 0.5 + 0.5);
      animationId = requestAnimationFrame(animate);
    };
    if (selectedCountry) {
      animationId = requestAnimationFrame(animate);
    } else {
      setPulse(0);
    }
    return () => cancelAnimationFrame(animationId);
  }, [selectedCountry]);

  const safeColor = useCallback((c) => {
    if (typeof c !== 'string' || !c || c === 'transparent') return THEME.dark.paper;
    // If it's a valid hex, rgb or rgba, return it. Otherwise fallback.
    if (c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl')) return c;
    return THEME.dark.paper;
  }, []);

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
    if (globeEl.current) {
      try {
        const renderer = globeEl.current.renderer();
        if (renderer) {
          renderer.setPixelRatio(perfProfile?.pixelRatio || 1);
          renderer.sortObjects = true;
        }

        const controls = globeEl.current.controls();
        if (controls) {
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

          // Track POV changes with a threshold to avoid jittery re-renders
          controls.addEventListener('change', () => {
             if (globeEl.current) {
                const pov = globeEl.current.pointOfView();
                setZoomLevel(prev => {
                   if (Math.abs(prev - pov.altitude) > 0.05) return pov.altitude;
                   return prev;
                });
                setCameraPOV(prev => {
                   // Larger threshold for home screen to keep background stable
                   const threshold = isHomeScreen ? 15 : 4;
                   if (Math.abs(prev.lat - pov.lat) > threshold || Math.abs(prev.lng - pov.lng) > threshold) {
                      return { lat: pov.lat, lng: pov.lng };
                   }
                   return prev;
                });
             }
          });
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
  }, [shouldAutoRotate, theme, perfProfile?.pixelRatio, perfProfile?.isMobile]);

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

  const REGION_COLORS = useMemo(() => CONTINENT_COLORS[theme] || CONTINENT_COLORS.dark, [theme]);
  const REGION_COLORS_ATTENUATED = useMemo(() => CONTINENT_COLORS_ATTENUATED[theme] || CONTINENT_COLORS_ATTENUATED.dark, [theme]);
  const REGION_COLORS_LABELS = useMemo(() => CONTINENT_COLORS_LABELS[theme] || CONTINENT_COLORS_LABELS.dark, [theme]);
  const UI_COLORS = useMemo(() => THEME[theme] || THEME.dark, [theme]);

  const foundSet = useMemo(() => new Set(foundList), [foundList]);

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

    // No continent colors on home screen
    if (isHomeScreen) {
      if (admin === selectedCountry) {
        if (isError) return UI_COLORS.error;
        return lerpColor(UI_COLORS.mapBase, UI_COLORS.accent, pulse * 0.6);
      }
      return UI_COLORS.mapBase;
    }

    if (foundSet.has(admin) || mode === 'learn') {
      const baseColor = REGION_COLORS[region] || UI_COLORS.success;
      if (admin === selectedCountry) {
        if (isError) return UI_COLORS.error;
        // Breathing effect for selected found country: between normal and lighter
        return lerpColor(
          baseColor,
          UI_COLORS.paper,
          pulse * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        );
      }
      return baseColor;
    }

    if (admin === selectedCountry) {
      if (isError) return UI_COLORS.error;
      const baseColor = REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
      // Breathing effect for selected unfound country
      return lerpColor(baseColor, REGION_COLORS[region] || UI_COLORS.accent, pulse * 0.6);
    }

    return UI_COLORS.mapBase;
  }, [selectedCountry, mode, foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, isError, pulse, isHomeScreen, isDepartmentMode, isEndScreen, isPerfectScore]);

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
      const baseStroke = (isHomeScreen ? UI_COLORS.accent : (REGION_COLORS[region] || UI_COLORS.accent));
      return lerpColor(
        baseStroke,
        UI_COLORS.paper,
        GLOBE_STYLE.lighting.selectedStrokeGlow[isLight ? 'light' : 'dark'] + (pulse * 0.12)
      );
    }

    if (isHomeScreen || (!foundSet.has(admin) && mode !== 'learn')) {
      return isLight
        ? UI_COLORS.mapBorderMuted
        : lerpColor(UI_COLORS.mapBase, UI_COLORS.paper, 0.15); // Slight glow instead of darkening
    }

    const baseColor = (!isHomeScreen && (foundSet.has(admin) || mode === 'learn'))
      ? (REGION_COLORS[region] || UI_COLORS.success)
      : UI_COLORS.mapBase;

    return lerpColor(
      baseColor,
      isLight ? UI_COLORS.ink : UI_COLORS.paper, // Use paper (white/light) for stroke in dark mode
      isLight ? GLOBE_STYLE.lighting.strokeDarken.light : 0.2 // Reduced darken for dark mode
    );
  }, [selectedCountry, UI_COLORS, REGION_COLORS, isError, foundSet, pulse, mode, isHomeScreen, isLight, isDepartmentMode, lerpColor, isPerfectScore]);

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
      baseColor = (!isHomeScreen && (foundSet.has(admin) || mode === 'learn'))
        ? (REGION_COLORS[region] || UI_COLORS.success)
        : UI_COLORS.mapBase;
    }

    if (globeLightingEnabled) {
      if (admin === selectedCountry) {
        if (isError) return isLight ? UI_COLORS.errorDeep : UI_COLORS.errorDeeper;
        
        // Base color for the side when selected under lighting
        const sideBaseColor = (!isHomeScreen && (foundSet.has(admin) || mode === 'learn'))
          ? (REGION_COLORS[region] || UI_COLORS.success)
          : (REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent);
          
        return lerpColor(
          sideBaseColor,
          UI_COLORS.black,
          isLight ? GLOBE_STYLE.lighting.sideDarken.selectedLight : GLOBE_STYLE.lighting.sideDarken.selectedDark
        );
      }
      if (!isHomeScreen && (foundSet.has(admin) || mode === 'learn')) {
        const base = REGION_COLORS[region] || UI_COLORS.success;
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
      
      const capColor = (!isHomeScreen && (foundSet.has(admin) || mode === 'learn'))
        ? lerpColor(
          REGION_COLORS[region] || UI_COLORS.success,
          UI_COLORS.paper,
          pulse * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        )
        : lerpColor(REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent, REGION_COLORS[region] || UI_COLORS.accent, pulse * 0.6);
        
      return lerpColor(capColor, UI_COLORS.black, isLight ? 0.24 : 0.08);
    }
    
    return lerpColor(baseColor, UI_COLORS.black, isLight ? 0.32 : 0.16);
  }, [foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, selectedCountry, isLight, globeLightingEnabled, pulse, mode, isHomeScreen, isDepartmentMode, lerpColor, getPolygonColor]);

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
    material.depthWrite = true; 
    
    // Set polygonOffset to false to eliminate holes and gaps perfectly
    material.polygonOffset = false;

    // Handle flat shading for the low-poly theme
    material.flatShading = (globeTheme === 'lowpoly');

    // Handle wireframe/opacity for the hologram blueprint theme
    const isFound = foundSet.has(admin) || mode === 'learn';
    if (globeTheme === 'blueprint') {
      material.wireframe = !isFound && admin !== selectedCountry;
      material.opacity = isFound || admin === selectedCountry ? 0.45 : 0.15;
      material.transparent = true;
    } else {
      material.wireframe = false;
      material.opacity = 1;
      material.transparent = false;
    }

    if (isDepartmentMode && d.isGhostCountry) {
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
      material.polygonOffset = true;
      material.polygonOffsetFactor = 1.5;
      material.polygonOffsetUnits = 1.5;
      if (material.isMeshPhongMaterial) {
        material.specular.set(globeLightingEnabled ? UI_COLORS.globeSpecular : UI_COLORS.ink);
        material.emissive.set(globeLightingEnabled ? UI_COLORS.globeEmissive : UI_COLORS.black);
        material.emissiveIntensity = globeLightingEnabled ? (isLight ? 0.1 : 0.2) : 0;
        material.shininess = globeLightingEnabled ? (isLight ? 4 : 8) : 0.7;
      } else {
        material.emissive.set(globeLightingEnabled ? UI_COLORS.globeEmissive : UI_COLORS.black);
        material.emissiveIntensity = globeLightingEnabled ? (isLight ? 0.1 : 0.2) : 0;
      }
      material.needsUpdate = true;
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
      material.flatShading = (globeTheme === 'lowpoly');
      material.needsUpdate = true;
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
    
    material.needsUpdate = true;
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
    if (isDepartmentMode && d.isGhostCountry) return 0.003;
    const admin = getFeatureAdmin(d);
    if (isDepartmentMode) {
      return getDepartmentLayerAltitude(admin, foundSet, selectedCountry) * (admin === selectedCountry ? (1 + pulse * 0.02) : 1);
    }
    const altitude = getCountryLayerAltitude(admin, foundSet, selectedCountry, globeLightingEnabled ? 1.8 : 1);
    if (admin === selectedCountry) return altitude * (1 + pulse * 0.08);
    return altitude;
  }, [globeLightingEnabled, selectedCountry, foundSet, pulse, isDepartmentMode]);

  const getSelectionEffectAltitude = useCallback(() => {
    if (isDepartmentMode) {
      return getDepartmentLayerAltitude(selectedCountry, foundSet, selectedCountry) + 0.0006;
    }
    const selectedAltitude = GLOBE_LAYER_ALTITUDE.selected * (globeLightingEnabled ? 1.8 : 1);
    return selectedAltitude * (1 + pulse * 0.08) + 0.004;
  }, [globeLightingEnabled, pulse, isDepartmentMode, foundSet, selectedCountry]);

  const getHtmlAltitude = useCallback((d) => {
    if (isDepartmentMode) {
      return getDepartmentLayerAltitude(d.admin, foundSet, selectedCountry) + 0.00025;
    }
    return getCountryLayerAltitude(
      d.admin,
      foundSet,
      selectedCountry,
      globeLightingEnabled ? 1.8 : 1
    ) + 0.002;
  }, [foundSet, globeLightingEnabled, isDepartmentMode, selectedCountry]);

  const getPolygonStrokeWidth = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    if (isDepartmentMode && d.isGhostCountry) {
      return perfProfile?.isMobile ? 0.045 : 0.06;
    }
    // Increased thickness for selection
    if (admin === selectedCountry) return perfProfile?.isMobile ? 2.1 : 3.0;
    if (isDepartmentMode) return perfProfile?.isMobile ? 0.55 : 0.75;
    if (isLight || globeLightingEnabled) return perfProfile?.isMobile ? 0.45 : 0.65;
    return perfProfile?.isMobile ? 0.25 : 0.4;
  }, [globeLightingEnabled, isLight, perfProfile?.isMobile, selectedCountry, isDepartmentMode]);

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
    if (globeTheme !== 'lowpoly' || isHomeScreen) return [];

    const assets = [];
    foundList.forEach(admin => {
      const data = gameDataMap[admin];
      if (!data || data.lat === undefined) return;

      const size = countrySizes[admin] || 1;
      const numModels = isDepartmentMode ? 1 : Math.min(5, Math.max(1, Math.floor(size * 0.3)));

      if (!biomePointsCacheRef.current[admin]) {
        const generated = [];
        const featureEntry = selectableFeatureIndex.find(entry => entry.admin === admin);
        
        let biomeType = data.region || 'Unknown';
        if (admin === 'France' || isDepartmentMode) {
          biomeType = 'France';
        }

        if (featureEntry && featureEntry.polygons.length > 0) {
          const bounds = featureEntry.bounds;
          for (let i = 0; i < numModels; i++) {
            let point = null;
            // Up to 15 tries to sample a point inside the polygon
            for (let attempt = 0; attempt < 15; attempt++) {
              const testLng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
              const testLat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
              if (featureEntry.polygons.some(poly => pointInPolygon(testLng, testLat, poly))) {
                point = { lat: testLat, lng: testLng };
                break;
              }
            }
            // Fallback to center with a minor jitter
            if (!point) {
              point = {
                lat: data.lat + (Math.random() - 0.5) * Math.min(0.2, size * 0.2),
                lng: data.lng + (Math.random() - 0.5) * Math.min(0.2, size * 0.2)
              };
            }
            generated.push({
              admin,
              lat: point.lat,
              lng: point.lng,
              biomeType,
              scale: 0.8 + Math.random() * 0.4,
              rotation: Math.random() * Math.PI * 2
            });
          }
        } else {
          // No boundary coords, fallback to center point
          generated.push({
            admin,
            lat: data.lat,
            lng: data.lng,
            biomeType,
            scale: 0.9,
            rotation: Math.random() * Math.PI * 2
          });
        }
        biomePointsCacheRef.current[admin] = generated;
      }

      assets.push(...biomePointsCacheRef.current[admin]);
    });

    return assets;
  }, [globeTheme, foundList, gameDataMap, countrySizes, selectableFeatureIndex, isDepartmentMode, isHomeScreen]);

  const createBiomeThreeObject = useCallback((d) => {
    const asset = createBiomeAsset(d.biomeType, theme);
    // Scale the custom model down to fit the globe nicely
    asset.scale.setScalar(d.scale * 0.38);
    return asset;
  }, [theme]);

  const updateBiomeThreeObject = useCallback((obj, d) => {
    // Rotate to point away from the sphere center
    obj.rotation.x = Math.PI / 2;
    obj.rotation.y = d.rotation;
  }, []);

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

  const globeMaterial = useMemo(() => {
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
  }, [UI_COLORS, isLight, globeLightingEnabled]);

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
        new THREE.SphereGeometry(1.015, 64, 64),
        new THREE.MeshBasicMaterial({
          color: UI_COLORS.globeInnerGlow,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
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
    innerGlow.material.color.set(UI_COLORS.globeInnerGlow);
    innerGlow.material.opacity = isLight ? 0.06 : 0.11;
    innerGlow.material.needsUpdate = true;
    return true;
  }, [isLight, globeLightingEnabled, UI_COLORS, perfProfile?.isMobile]);

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

    scene.traverse((obj) => {
      const material = obj.material;
      if (
        obj.type === 'LineSegments' &&
        material?.type === 'LineBasicMaterial' &&
        material.transparent === true
      ) {
        material.color.set(UI_COLORS.graticule);
        material.opacity = isLight
          ? GLOBE_STYLE.lighting.graticuleOpacity.light
          : GLOBE_STYLE.lighting.graticuleOpacity.dark;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    });
  }, [isLight, UI_COLORS]);

  useEffect(() => {
    const frame = requestAnimationFrame(styleGlobeGraticules);
    return () => cancelAnimationFrame(frame);
  }, [styleGlobeGraticules]);

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
    if (isDepartmentMode) return [];

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
  }, [countriesWithGeometry, tinyCountries, isDepartmentMode, gameDataMap]);

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
      const baseColor = REGION_COLORS[region] || UI_COLORS.success;
      if (isSelected) {
        if (isError) return UI_COLORS.error;
        return lerpColor(
          baseColor,
          UI_COLORS.paper,
          pulse * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? 'light' : 'dark']
        );
      }
      return baseColor;
    }
    
    if (isSelected) {
      if (isError) return UI_COLORS.error;
      const baseColor = REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
      return lerpColor(baseColor, REGION_COLORS[region] || UI_COLORS.accent, pulse * 0.6);
    }
    
    return UI_COLORS.mapBase;
  }, [REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, foundSet, isError, selectedCountry, mode, pulse, isDepartmentMode, isEndScreen, isPerfectScore]);

  const getPointRadius = useCallback((d) => (
    isDepartmentMode
      ? (d.admin === selectedCountry ? 0.12 : 0.055)
      : (d.admin === selectedCountry ? 0.22 : 0.12)
  ), [isDepartmentMode, selectedCountry]);

  const getPointAltitude = useCallback((d) => {
    return getCountryLayerAltitude(d.admin, foundSet, selectedCountry);
  }, [foundSet, selectedCountry]);


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
    if (globeTheme === 'lowpoly') {
      return selectedCountry ? 2 : 12;
    }
    return perfProfile?.polygonCapCurvatureResolution ?? 8;
  }, [globeTheme, selectedCountry, perfProfile]);

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
        <div ref={globeContentWrapperRef} className="globe-content-wrapper" style={{ background: 'transparent' }}>
          {globeLightingEnabled && (
            <div
              className={`globe-studio-overlay ${isLight ? 'light' : 'dark'}`}
              aria-hidden="true"
            />
          )}
          <Globe
            ref={globeEl}
            width={globeWidth}
            height={globeHeight}
            globeImageUrl={null}
            globeMaterial={globeMaterial}
            backgroundImageUrl={null}
            showAtmosphere={!!perfProfile?.showAtmosphere}
            atmosphereColor={safeColor(UI_COLORS.atmosphere)}
            atmosphereDayQuotient={isLight ? 0.2 : 0.1}
            onGlobeReady={handleGlobeReady}
            backgroundColor={safeColor(UI_COLORS.bg)}
            lineHoverPrecision={0}
            showGraticules={true}
            rendererConfig={{ antialias: perfProfile?.antialias !== false, logarithmicDepthBuffer: false, powerPreference: "high-performance" }}
            animateIn={false}
            enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
            polygonsData={visibleRenderCountriesData}
            polygonGeoJsonGeometry="renderGeometry"
            polygonCapCurvatureResolution={effectiveResolution}
            polygonAltitude={getPolygonAltitude}
            polygonCapColor={(d) => safeColor(getPolygonColor(d))}
            polygonCapMaterial={globeLightingEnabled ? getPolygonCapMaterial : undefined}
            polygonSideColor={(d) => safeColor(getPolygonSideColor(d))}
            polygonSideMaterial={globeLightingEnabled ? getPolygonSideMaterial : undefined}
            polygonStrokeColor={(d) => safeColor(getPolygonStroke(d))}
            polygonStrokeWidth={getPolygonStrokeWidth}
            polygonAltitudeUpdateMs={50}
            polygonsTransitionDuration={SELECTION_TRANSITION_DURATION}
            pointsData={visibleMarkersData}
            pointLat="lat"
            pointLng="lng"
            pointColor={(d) => safeColor(getPointColor(d))}
            pointRadius={getPointRadius}
            pointAltitude={getPointAltitude}
            pointsTransitionDuration={SELECTION_TRANSITION_DURATION}
            htmlElementsData={labelsData}
            htmlElement={createLabelElement}
            htmlLat={d => d.lat}
            htmlLng={d => d.lng}
            htmlAltitude={getHtmlAltitude}
            ringsData={ringsData}
            ringColor={(d) => safeColor(getRingColor(d))}
            ringMaxRadius={d => d.maxRadius}
            ringPropagationSpeed={d => d.speed}
            ringRepeatPeriod={d => d.repeat}
            ringAltitude={getSelectionEffectAltitude}
            customLayerData={getBiomeAssetsData}
            customThreeObject={createBiomeThreeObject}
            customThreeObjectUpdate={updateBiomeThreeObject}
            onBackgroundClick={isHomeScreen ? undefined : () => selectCountry(null)}
          />
        </div>
    </div>
  );
};

export default React.memo(GlobeMap);
