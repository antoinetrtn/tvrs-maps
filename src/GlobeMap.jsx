import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';
import { THEME, CONTINENT_COLORS, CONTINENT_COLORS_ATTENUATED, CONTINENT_COLORS_LABELS, GLOBE_STYLE } from './designSystem';

const getFeatureAdmin = (feature) => feature?.properties?.ADMIN || feature?.properties?.name || feature?.properties?.NAME;

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

const getCountryLayerAltitude = (admin, foundSet, selectedCountry, extrusionScale = 1) => {
  if (admin === selectedCountry) return GLOBE_LAYER_ALTITUDE.selected * extrusionScale;
  if (foundSet.has(admin)) return GLOBE_LAYER_ALTITUDE.found * extrusionScale;
  return GLOBE_LAYER_ALTITUDE.base * extrusionScale;
};

const GlobeMap = ({
  mode,
  lang,
  countriesData,
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
  globeLightingEnabled = true
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
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: viewport.width < 768 ? 2.2 : 1.8 }, 1200);
    } else if (selectedCountry && globeEl.current) {
      const data = countryDataMap[selectedCountry];
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
    } else if (wasHomeScreenRef.current && globeEl.current) {
      globeEl.current.pointOfView({ lat: 18, lng: 20, altitude: viewport.width < 768 ? 1.8 : 1.35 }, 700);
    }
    wasHomeScreenRef.current = isHomeScreen;
    previousSelectedCountryRef.current = selectedCountry;
  }, [selectedCountry, viewport.width, viewport.height, viewport.top, isHomeScreen, perfProfile, isKeyboardMode, isEndScreen]);

  const isLight = theme === 'light';

  const selectableCountriesData = useMemo(() => {
    return countriesData.filter(feature => countryDataMap[getFeatureAdmin(feature)]);
  }, [countriesData]);

  const baseRenderCountriesData = useMemo(() => {
    return selectableCountriesData.map(feature => ({
      ...feature,
      renderGeometry: getRenderGeometry(feature)
    }));
  }, [selectableCountriesData]);

  const renderCountriesData = useMemo(() => {
    return baseRenderCountriesData;
  }, [baseRenderCountriesData]);

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
      if (!admin || countryDataMap[admin]) {
        onCountrySelect(admin);
      }
    }
  }, [onCountrySelect]);

  const selectCountryAtLngLat = useCallback((lng, lat) => {
    const match = selectableFeatureIndex.find(entry => featureContainsLngLat(entry, lng, lat));
    if (match) {
      selectCountry(match.admin);
      return;
    }

    // GeoJSON at 110m is very simplified; a tap near a coast/border can land just
    // outside the polygon. Fall back to the closest capital/country point nearby.
    let best = null;
    Object.entries(countryDataMap).forEach(([admin, data]) => {
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
  }, [selectableFeatureIndex, selectCountry]);

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
  }, [selectedCountry, mode, foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, isError, pulse, isHomeScreen]);

  const getPolygonStroke = useCallback((d) => {
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
  }, [selectedCountry, UI_COLORS, REGION_COLORS, isError, foundSet, pulse, mode, isHomeScreen, isLight]);

  const getPolygonSideColor = useCallback((d) => {
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
  }, [foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, selectedCountry, isLight, globeLightingEnabled, pulse, mode, isHomeScreen]);

  const getPolygonMaterial = useCallback((d, kind) => {
    const admin = getFeatureAdmin(d) || 'unknown';
    const cache = polygonMaterialCacheRef.current[kind];
    const color = kind === 'cap' ? getPolygonColor(d) : getPolygonSideColor(d);
    let material = cache.get(admin);

    if (material && !material.isMeshPhongMaterial) {
      material.dispose();
      cache.delete(admin);
      material = null;
    }

    if (!material) {
      material = new THREE.MeshPhongMaterial({
        side: kind === 'cap' ? THREE.DoubleSide : THREE.DoubleSide, // Ensure sides are visible from all angles
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: true // Re-enable depthWrite for solid volume feel
      });
      cache.set(admin, material);
    }

    material.color.set(color);
    
    // Opacity from Design System
    const baseOpacity = kind === 'cap' 
      ? GLOBE_STYLE.lighting.capOpacity[isLight ? 'light' : 'dark']
      : GLOBE_STYLE.lighting.sideOpacity[isLight ? 'light' : 'dark'];
    
    const selectedOpacity = kind === 'cap' ? 1 : GLOBE_STYLE.lighting.selectedSideOpacity[isLight ? 'light' : 'dark'];

    material.opacity = admin === selectedCountry ? selectedOpacity : baseOpacity;
    material.transparent = material.opacity < 1;
    
    // DepthWrite is critical for visibility over the globe sphere
    // We keep it true to ensure the "glass" has volume and occludes the sea
    material.depthWrite = true; 
    
    // Apply offset to both to push the entire volume slightly back, 
    // letting the stroke (lines) always render on top.
    material.polygonOffset = true;
    material.polygonOffsetFactor = 1;
    material.polygonOffsetUnits = 1;
    
    if (globeLightingEnabled) {
      material.specular.set(UI_COLORS.mapBorder);
      material.emissive.set(color);
      
      const baseEmissiveIntensity = (kind === 'cap'
        ? (isLight ? GLOBE_STYLE.lighting.material.capEmissiveLight : GLOBE_STYLE.lighting.material.capEmissiveDark)
        : (isLight ? GLOBE_STYLE.lighting.material.sideEmissiveLight : GLOBE_STYLE.lighting.material.sideEmissiveDark));
      
      // Glass effect: boost emissive in dark mode to recover light
      const emissiveBoost = !isLight ? 0.18 : 0.05;
      material.emissiveIntensity = baseEmissiveIntensity + emissiveBoost + (
        admin === selectedCountry ? 0.1 : 0
      );
      
      const baseShininess = (kind === 'cap'
        ? (isLight ? GLOBE_STYLE.lighting.material.capShininessLight : GLOBE_STYLE.lighting.material.capShininessDark)
        : (isLight ? GLOBE_STYLE.lighting.material.sideShininessLight : GLOBE_STYLE.lighting.material.sideShininessDark));
      
      material.shininess = baseShininess + (isLight ? 0 : 25);
    } else {
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
      material.shininess = 0.7;
    }
    
    material.needsUpdate = true;
    return material;
  }, [getPolygonColor, getPolygonSideColor, isLight, globeLightingEnabled, UI_COLORS, selectedCountry]);

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
    const admin = getFeatureAdmin(d);
    const altitude = getCountryLayerAltitude(admin, foundSet, selectedCountry, globeLightingEnabled ? 1.8 : 1);
    if (admin === selectedCountry) return altitude * (1 + pulse * 0.08);
    return altitude;
  }, [globeLightingEnabled, selectedCountry, foundSet, pulse]);

  const getSelectionEffectAltitude = useCallback(() => {
    const selectedAltitude = GLOBE_LAYER_ALTITUDE.selected * (globeLightingEnabled ? 1.8 : 1);
    return selectedAltitude * (1 + pulse * 0.08) + 0.004;
  }, [globeLightingEnabled, pulse]);

  const getPolygonStrokeWidth = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    // Increased thickness for selection
    if (admin === selectedCountry) return perfProfile?.isMobile ? 2.1 : 3.0;
    if (isLight || globeLightingEnabled) return perfProfile?.isMobile ? 0.45 : 0.65;
    return perfProfile?.isMobile ? 0.25 : 0.4;
  }, [globeLightingEnabled, isLight, perfProfile?.isMobile, selectedCountry]);

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
    
    const keysToShow = (mode === 'learn' || isHomeScreen || isEndScreen) ? Object.keys(countryDataMap) : foundList;
    const pov = cameraPOV;

    const filtered = keysToShow
      .map(adminKey => {
        const data = countryDataMap[adminKey];
        if (!data) return null;
        
        const isSelected = adminKey === selectedCountry;
        const size = countrySizes[adminKey] || 0.5;
        
        // Visibility based on zoom level
        const visibilityThreshold = isSelected ? 10 : (isHomeScreen ? 1.8 : Math.min(3.0, 0.8 + size * 2.0));
        
        if (zoomLevel > visibilityThreshold) return null;

        let dLng = Math.abs(data.lng - pov.lng);
        if (dLng > 180) dLng = 360 - dLng;
        const distToCenter = Math.hypot(dLng, data.lat - pov.lat);
        
        if (!isSelected && distToCenter > 95) return null;

        // Use cached object if available to maintain reference stability
        const cached = labelsCacheRef.current[adminKey];
        if (cached && cached.isSelected === isSelected && cached.lang === lang) {
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
          size,
          distToCenter,
          isSelected,
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

    return perfProfile?.maxLabels ? filtered.slice(0, perfProfile.maxLabels) : filtered;
  }, [foundList, countrySizes, zoomLevel, cameraPOV, lang, perfProfile?.maxLabels, mode, selectedCountry, isHomeScreen]);

  const createLabelElement = useCallback((d) => {
    const el = document.createElement('div');
    const color = isHomeScreen ? UI_COLORS.textMuted : (REGION_COLORS_LABELS[d.region] || UI_COLORS.warning);
    
    // Set root to 0 size so its center is the exact lat/lng
    el.style.width = '0';
    el.style.height = '0';
    el.style.position = 'relative';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';

    el.innerHTML = `
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
  }, [REGION_COLORS_LABELS, UI_COLORS, isHomeScreen]);

  const ringsData = useMemo(() => {
    if (selectedCountry) {
      const mapped = countryDataMap[selectedCountry];
      const region = mapped?.region || 'Unknown';
      if (mapped && mapped.lat !== undefined) {
        const baseColor = isError
          ? UI_COLORS.error
          : (REGION_COLORS_LABELS[region] || REGION_COLORS[region] || UI_COLORS.accent);
        const softColor = lerpColor(baseColor, UI_COLORS.paper, isLight ? 0.35 : 0.2);
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
  }, [isError, isLight, perfProfile?.isMobile, REGION_COLORS, REGION_COLORS_LABELS, selectedCountry, UI_COLORS]);

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
  }, [isLight, globeLightingEnabled, UI_COLORS]);

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
  }, [countriesWithGeometry, tinyCountries]);

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
  }, [REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, foundSet, isError, selectedCountry, mode, pulse]);

  const getPointRadius = useCallback((d) => (
    d.admin === selectedCountry ? 0.22 : 0.12
  ), [selectedCountry]);

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
            backgroundColor="transparent"
            lineHoverPrecision={0}
            showGraticules={true}
            rendererConfig={{ antialias: perfProfile?.antialias !== false, logarithmicDepthBuffer: false, powerPreference: "high-performance" }}
            animateIn={false}
            enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
            polygonsData={visibleRenderCountriesData}
            polygonGeoJsonGeometry="renderGeometry"
            polygonCapCurvatureResolution={perfProfile?.polygonCapCurvatureResolution ?? 8}
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
            htmlAltitude={GLOBE_LAYER_ALTITUDE.label}
            ringsData={ringsData}
            ringColor={(d) => safeColor(getRingColor(d))}
            ringMaxRadius={d => d.maxRadius}
            ringPropagationSpeed={d => d.speed}
            ringRepeatPeriod={d => d.repeat}
            ringAltitude={getSelectionEffectAltitude}
            onBackgroundClick={isHomeScreen ? undefined : () => selectCountry(null)}
          />
        </div>
    </div>
  );
};

export default React.memo(GlobeMap);
