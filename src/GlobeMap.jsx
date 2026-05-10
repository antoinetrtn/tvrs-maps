import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';
import { THEME, CONTINENT_COLORS, CONTINENT_COLORS_ATTENUATED, CONTINENT_COLORS_LABELS } from './designSystem';

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

const getExteriorPolygonForRendering = (polygon) => (
  polygon?.[0] ? [polygon[0]] : polygon
);

const getRenderGeometry = (feature) => {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: getExteriorPolygonForRendering(geometry.coordinates)
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(getExteriorPolygonForRendering)
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

const GLOBE_LAYER_ALTITUDE = {
  base: 0.01,
  found: 0.05,
  selected: 0.1,
  label: 0.15
};
const SELECTION_TRANSITION_DURATION = 140;

const getCountryLayerAltitude = (admin, foundSet, selectedCountry) => {
  if (admin === selectedCountry) return GLOBE_LAYER_ALTITUDE.selected;
  if (foundSet.has(admin)) return GLOBE_LAYER_ALTITUDE.found;
  return GLOBE_LAYER_ALTITUDE.base;
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
  isKeyboardMode
}) => {
  const globeEl = useRef();
  const tapRef = useRef(null);
  const previousSelectedCountryRef = useRef(null);
  const lastTargetRef = useRef(null);
  const layoutViewportRef = useRef({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const wasHomeScreenRef = useRef(isHomeScreen);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [pulse, setPulse] = useState(0);

  // Pulse animation loop for selection
  useEffect(() => {
    let animationId;
    let start;
    const animate = (time) => {
      if (!start) start = time;
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

  const lerpColor = (a, b, amount) => {
    const ah = +a.replace('#', '0x'),
          bh = +b.replace('#', '0x'),
          ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
          br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
          rr = ar + amount * (br - ar),
          rg = ag + amount * (bg - ag),
          rb = ab + amount * (bb - ab);
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + (rb | 0)).toString(16).slice(1);
  };
  
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

          // Track POV changes with a threshold to avoid jittery re-renders
          controls.addEventListener('change', () => {
             if (globeEl.current) {
                const pov = globeEl.current.pointOfView();
                setZoomLevel(prev => {
                   if (Math.abs(prev - pov.altitude) > 0.1) return pov.altitude;
                   return prev;
                });
             }
          });
        }

        const camera = globeEl.current.camera();
        if (camera) {
          camera.clearViewOffset();
        }
      } catch (e) {}
    }
  }, [shouldAutoRotate, theme, perfProfile?.pixelRatio, perfProfile?.isMobile]);

  useEffect(() => {
    if (selectedCountry && globeEl.current) {
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
        const latOffset = isKeyboardOpen ? 0 : (isMobile ? -10 : 0);
        const target = {
          lat: data.lat + latOffset,
          lng: data.lng,
          altitude: hasPreviousSelection ? preservedAltitude : Math.min(preservedAltitude, fallbackAltitude)
        };
        const previousTarget = lastTargetRef.current;
        const onlyViewportNudge = previousTarget &&
          previousSelectedCountryRef.current === selectedCountry &&
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
  }, [selectedCountry, viewport.height, isHomeScreen, perfProfile, isKeyboardMode]);

  const isLight = theme === 'light';

  const selectableCountriesData = useMemo(() => {
    return countriesData.filter(feature => countryDataMap[getFeatureAdmin(feature)]);
  }, [countriesData]);

  const renderCountriesData = useMemo(() => {
    return selectableCountriesData.map(feature => ({
      ...feature,
      renderGeometry: getRenderGeometry(feature)
    }));
  }, [selectableCountriesData]);

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
    if (admin && countryDataMap[admin] && onCountrySelect) {
      onCountrySelect(admin);
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
    if (best && best.dist < 6) selectCountry(best.admin);
  }, [selectableFeatureIndex, selectCountry]);

  const handlePointerDown = useCallback((event) => {
    if (event.target?.tagName !== 'CANVAS') return;
    if (event.pointerType === 'touch' && selectedCountry && viewport.width < 1024) {
      event.preventDefault();
    }
    tapRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now()
    };
  }, [selectedCountry, viewport.width]);

  const handlePointerUp = useCallback((event) => {
    const tap = tapRef.current;
    tapRef.current = null;
    if (!tap || tap.pointerId !== event.pointerId) return;

    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    const moved = Math.hypot(dx, dy);
    const elapsed = performance.now() - tap.t;
    if (moved > 10 || elapsed > 600 || !globeEl.current?.toGlobeCoords) return;

    const coords = globeEl.current.toGlobeCoords(event.clientX, event.clientY);
    if (coords) selectCountryAtLngLat(coords.lng, coords.lat);
  }, [selectCountryAtLngLat]);

  const REGION_COLORS = useMemo(() => CONTINENT_COLORS[theme] || CONTINENT_COLORS.dark, [theme]);
  const REGION_COLORS_ATTENUATED = useMemo(() => CONTINENT_COLORS_ATTENUATED[theme] || CONTINENT_COLORS_ATTENUATED.dark, [theme]);
  const REGION_COLORS_LABELS = useMemo(() => CONTINENT_COLORS_LABELS[theme] || CONTINENT_COLORS_LABELS.dark, [theme]);
  const UI_COLORS = useMemo(() => THEME[theme] || THEME.dark, [theme]);

  const foundSet = useMemo(() => new Set(foundList), [foundList]);

  const getPolygonColor = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';

    if (foundSet.has(admin)) {
      const baseColor = REGION_COLORS[region] || UI_COLORS.success;
      if (admin === selectedCountry) {
        if (isError) return UI_COLORS.error;
        // Breathing effect for selected found country: between normal and lighter
        return lerpColor(baseColor, '#ffffff', pulse * 0.4);
      }
      return baseColor;
    }

    if (admin === selectedCountry) {
      if (isError) return UI_COLORS.error;
      const baseColor = REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
      // Breathing effect for selected unfound country
      return lerpColor(baseColor, REGION_COLORS[region] || UI_COLORS.accent, pulse * 0.6);
    }

    return mode === 'capitals' ? UI_COLORS.mapBase : UI_COLORS.mapBase;
  }, [selectedCountry, mode, foundSet, REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, isError, pulse]);

  const getPolygonStroke = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';

    if (admin === selectedCountry) {
      if (isError) return UI_COLORS.error;
      const baseStroke = REGION_COLORS_LABELS[region] || UI_COLORS.accent;
      // Selection stroke: pulses for visibility on the 3D block
      return lerpColor(baseStroke, isLight ? '#000000' : '#ffffff', pulse * 0.5);
    }
    
    // Normal countries have a very subtle border, the 3D 'side' will provide the depth
    return 'rgba(0,0,0,0.15)';
  }, [selectedCountry, UI_COLORS, REGION_COLORS_LABELS, isError, foundSet, isLight, pulse]);

  const getPolygonSideColor = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    const region = countryDataMap[admin]?.region || 'Unknown';
    const baseColor = foundSet.has(admin) 
      ? (REGION_COLORS[region] || UI_COLORS.success)
      : UI_COLORS.mapBase;

    if (admin === selectedCountry) {
      if (isError) return isLight ? '#dc7f7f' : '#991b1b';
      // Pulsing sides for selection
      return lerpColor(baseColor, isLight ? '#000000' : '#ffffff', pulse * 0.4);
    }
    
    // Regular sides: darkened version of the country color for a tinted black edge feel
    return lerpColor(baseColor, '#000000', 0.65);
  }, [foundSet, isError, isLight, selectedCountry, UI_COLORS, REGION_COLORS, pulse]);

  const getPolygonAltitude = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    return getCountryLayerAltitude(admin, foundSet, selectedCountry);
  }, [selectedCountry, foundSet]);

  const getPolygonStrokeWidth = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    // Keep it crisp at 1px since webgl limits often prevent thicker lines
    return admin === selectedCountry ? 1.0 : 0.4;
  }, [selectedCountry]);

  const countrySizes = useMemo(() => {
    const sizes = {};
    selectableFeatureIndex.forEach(entry => {
      const b = entry.bounds;
      // Approximate "radius" in degrees
      sizes[entry.admin] = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat);
    });
    return sizes;
  }, [selectableFeatureIndex]);

  const labelsData = useMemo(() => {
    if (perfProfile?.maxLabels === 0) return [];
    
    // We filter based on zoom level and country size
    // Larger countries stay visible longer (higher zoomLevel/altitude)
    return foundList
      .map(adminKey => {
        const data = countryDataMap[adminKey];
        if (!data) return null;
        
        const size = countrySizes[adminKey] || 0.5;
        // Occlusion threshold: small countries disappear earlier (lower zoomLevel/altitude)
        const visibilityThreshold = Math.min(2.8, 0.4 + size * 1.2);
        
        if (zoomLevel > visibilityThreshold) return null;

        return {
          admin: adminKey,
          lat: data.lat,
          lng: data.lng,
          country: lang === 'fr' ? (data.name_fr || adminKey) : (data.name_en || adminKey),
          capital: lang === 'fr' ? (data.capital_fr || data.capital) : data.capital,
          region: data.region,
          flag: getFlagEmoji(data.iso2)
        };
      })
      .filter(d => d !== null);
  }, [foundList, countrySizes, zoomLevel, lang, perfProfile?.maxLabels]);

  const createLabelElement = useCallback((d) => {
    const el = document.createElement('div');
    const color = REGION_COLORS_LABELS[d.region] || UI_COLORS.warning;
    
    // Set root to 0 size so its center is the exact lat/lng
    el.style.width = '0';
    el.style.height = '0';
    el.style.position = 'relative';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';

    el.innerHTML = `
      <div style="
        position: absolute;
        width: 6px;
        height: 6px;
        background: ${color};
        border-radius: 50%;
        left: -3px;
        top: -3px;
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
          opacity: 0.9;
        ">(${d.capital})</div>
      </div>
    `;
    return el;
  }, [REGION_COLORS_LABELS, UI_COLORS]);

  const ringsData = useMemo(() => {
    const shouldShowRing = selectedCountry;
    if (shouldShowRing) {
       const mapped = countryDataMap[selectedCountry];
       if (mapped && mapped.lat !== undefined) {
          return [{ lat: mapped.lat, lng: mapped.lng }];
       }
    }
    return [];
  }, [selectedCountry, perfProfile?.isMobile, hasActiveFeedback]);

  const globeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: UI_COLORS.mapSea,
      depthTest: true,
      depthWrite: true
    });
  }, [UI_COLORS]);

  useEffect(() => {
    return () => {
      globeMaterial.dispose();
    };
  }, [globeMaterial]);

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

  const getPolygonStrokeWidth = useCallback((d) => {
    const admin = getFeatureAdmin(d);
    // Slightly thicker general borders, and a bit more for selection
    return admin === selectedCountry ? 1.5 : 0.6;
  }, [selectedCountry]);

  const getPointColor = useCallback((d) => {
    const isFound = foundSet.has(d.admin);
    const isSelected = d.admin === selectedCountry;
    const region = d.region || 'Unknown';

    if (isFound) {
      if (isSelected) return isError ? UI_COLORS.error : UI_COLORS.success;
      return REGION_COLORS[region] || UI_COLORS.success;
    }
    if (isSelected) {
      if (isError) return UI_COLORS.error;
      return REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
    }
    
    return UI_COLORS.mapBase;
  }, [REGION_COLORS, REGION_COLORS_ATTENUATED, UI_COLORS, foundSet, isError, selectedCountry]);

  const getPointRadius = useCallback((d) => (
    d.admin === selectedCountry ? 0.32 : 0.18
  ), [selectedCountry]);

  const getPointAltitude = useCallback((d) => {
    return getCountryLayerAltitude(d.admin, foundSet, selectedCountry);
  }, [foundSet, selectedCountry]);


  const getLabelColor = useCallback((d) => (
    REGION_COLORS_LABELS[d.region] || UI_COLORS.warning
  ), [REGION_COLORS_LABELS, UI_COLORS]);

  const getRingColor = useCallback(() => {
    if (isError) return UI_COLORS.error;
    const region = countryDataMap[selectedCountry]?.region || 'Unknown';
    // Use the vibrant label color for the radar ring
    return REGION_COLORS_LABELS[region] || (isLight ? 'rgba(37, 99, 235, 0.6)' : 'rgba(255, 255, 255, 0.5)');
  }, [isError, isLight, UI_COLORS, selectedCountry, REGION_COLORS_LABELS]);

  return (
    <div 
      className={`globe-map-shell ${isHomeScreen ? 'home-layout' : 'game-layout'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { tapRef.current = null; }}
      style={{ 
        position: 'fixed', 
        top: isMobileKeyboardOpen ? viewport.top : 0, 
        left: isMobileKeyboardOpen ? viewport.left : 0, 
        width: globeWidth,
        height: globeHeight,
        zIndex: 0, 
        overflow: 'hidden',
        transition: 'top 220ms cubic-bezier(0.2, 0.9, 0.2, 1), left 220ms cubic-bezier(0.2, 0.9, 0.2, 1), width 220ms cubic-bezier(0.2, 0.9, 0.2, 1), height 220ms cubic-bezier(0.2, 0.9, 0.2, 1)',
        background: isLight 
          ? 'linear-gradient(to bottom, #e0f2fe 0%, #f8fafc 100%)' 
          : 'transparent'
      }}
    >
        {isLight && (
          <div className="day-decorations" style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
             <div style={{
               position: 'absolute',
               width: '100%',
               height: '100%',
               backgroundImage: 'radial-gradient(rgba(0,0,0,0.12) 1.2px, transparent 0)',
               backgroundSize: '40px 40px',
               opacity: 0.8
             }} />
             <div style={{ 
               position: 'absolute', 
               top: '-10%', 
               left: '-10%', 
               width: '60%', 
               height: '60%', 
               background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
               filter: 'blur(40px)'
             }} />
          </div>
        )}
        <Globe
          ref={globeEl}
          width={globeWidth}
          height={globeHeight}
          globeImageUrl={null}
          globeMaterial={globeMaterial}
          backgroundImageUrl={null}
          showAtmosphere={!!perfProfile?.showAtmosphere}
          atmosphereColor={isLight ? "#b0e2ff" : "#3a76f0"}
          atmosphereDayQuotient={isLight ? 0.2 : 0.1}
          backgroundColor="rgba(0,0,0,0)"
          lineHoverPrecision={0}
          rendererConfig={{ antialias: true, logarithmicDepthBuffer: false, powerPreference: "high-performance" }}
          animateIn={false}
          enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
          polygonsData={renderCountriesData}
          polygonGeoJsonGeometry="renderGeometry"
          polygonCapCurvatureResolution={perfProfile?.polygonCapCurvatureResolution ?? 8}
          polygonAltitude={getPolygonAltitude}
          polygonCapColor={getPolygonColor}
          polygonSideColor={getPolygonSideColor}
          polygonStrokeColor={getPolygonStroke}
          polygonStrokeWidth={getPolygonStrokeWidth}
          polygonAltitudeUpdateMs={0}
          polygonsTransitionDuration={SELECTION_TRANSITION_DURATION}
          pointsData={markersData}
          pointLat="lat"
          pointLng="lng"
          pointColor={getPointColor}
          pointRadius={getPointRadius}
          pointAltitude={getPointAltitude}
          pointsTransitionDuration={SELECTION_TRANSITION_DURATION}
          htmlElementsData={labelsData}
          htmlElement={createLabelElement}
          htmlLat={d => d.lat}
          htmlLng={d => d.lng}
          htmlAltitude={GLOBE_LAYER_ALTITUDE.label}
          ringsData={ringsData}
          ringColor={getRingColor}
          ringMaxRadius={perfProfile?.isMobile ? 1.0 : 1.4}
          ringPropagationSpeed={perfProfile?.isMobile ? 0.35 : 0.5}
          ringRepeatPeriod={perfProfile?.isMobile ? 2400 : 2000}
          ringAltitude={GLOBE_LAYER_ALTITUDE.selected}
        />
    </div>
  );
};

export default React.memo(GlobeMap);
