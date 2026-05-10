import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';

const getFeatureAdmin = (feature) => feature?.properties?.ADMIN;

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
  base: 0.014,
  found: 0.014,
  selected: 0.017
};

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
        const fallbackAltitude = isMobile ? 1.8 : 0.8;
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
      globeEl.current.pointOfView({ altitude: 2.5 }, 1000);
    }
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

  const REGION_COLORS = useMemo(() => ({
    "Europe": isLight ? "#86b7f5" : "#3b82f6",
    "Americas": isLight ? "#7fcc9a" : "#22c55e",
    "Asia": isLight ? "#ef9a9a" : "#ef4444",
    "Africa": isLight ? "#e8c76c" : "#eab308",
    "Oceania": isLight ? "#c5a0f2" : "#a855f7",
    "Antarctic": isLight ? "#d4dde8" : "#94a3b8",
    "Unknown": isLight ? "#cbd5e1" : "#64748b"
  }), [isLight]);

  const foundSet = useMemo(() => new Set(foundList), [foundList]);

  const getPolygonColor = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (foundSet.has(admin)) {
      if (admin === selectedCountry) return isError ? "#fca5a5" : "#72d38f";
      const region = countryDataMap[admin]?.region;
      return REGION_COLORS[region] || (isLight ? "#8edaa5" : "#22c55e");
    }
    if (admin === selectedCountry) {
      if (isError) return isLight ? "#fca5a5" : "#ef4444";
      return isLight ? "#93c5fd" : "#60a5fa"; 
    }
    if (mode === 'capitals') return isLight ? "#d7e9fc" : "#12264c";
    return isLight ? "#d9ecff" : "#193456";
  }, [selectedCountry, mode, foundSet, REGION_COLORS, isLight, isError]);

  const getPolygonStroke = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (admin === selectedCountry) {
      if (isError) return '#ef4444';
      return isLight ? '#1e3a8a' : '#ffffff';
    }
    return isLight ? '#86aede' : '#31598d';
  }, [selectedCountry, foundSet, isLight, isError]);

  const getPolygonAltitude = useCallback((d) => {
    const admin = d.properties.ADMIN;
    return getCountryLayerAltitude(admin, foundSet, selectedCountry);
  }, [selectedCountry, foundSet]);

  const labelsData = useMemo(() => {
    if (perfProfile?.maxLabels === 0) return [];
    const labelKeys = Number.isFinite(perfProfile?.maxLabels)
      ? foundList.slice(-perfProfile.maxLabels)
      : foundList;

    return labelKeys
      .map(adminKey => countryDataMap[adminKey])
      .filter(data => data && data.lat !== undefined)
      .map(data => ({
        id: data.iso2 || data.capital,
        lat: data.lat,
        lng: data.lng,
        text: data.capital_fr || data.capital,
        region: data.region
      }));
  }, [foundList, perfProfile?.maxLabels]);

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
      color: isLight ? '#a5c9f5' : '#0a1a3a',
      depthTest: true,
      depthWrite: true
    });
  }, [isLight]);

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

  const polygonSideColor = useCallback(() => null, []);

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

  const getPolygonStrokeWidth = useCallback((d) => (
    d.properties.ADMIN === selectedCountry
      ? 0.8
      : 0.35
  ), [selectedCountry]);

  const getPointColor = useCallback((d) => {
    const isFound = foundSet.has(d.admin);
    const isSelected = d.admin === selectedCountry;
    if (isFound) {
      if (isSelected) return isError ? "#fca5a5" : "#72d38f";
      return REGION_COLORS[d.region] || (isLight ? "#8edaa5" : "#22c55e");
    }
    if (isSelected) {
      if (isError) return isLight ? "#fca5a5" : "#ef4444";
      return isLight ? "#93c5fd" : "#60a5fa";
    }
    
    // Match unselected country styling
    if (mode === 'capitals') return isLight ? "#d7e9fc" : "#12264c";
    return isLight ? "#d9ecff" : "#193456";
  }, [REGION_COLORS, foundSet, isError, isLight, selectedCountry, mode]);

  const getPointRadius = useCallback((d) => (
    d.admin === selectedCountry ? 0.32 : 0.18
  ), [selectedCountry]);

  const getPointAltitude = useCallback((d) => {
    return getCountryLayerAltitude(d.admin, foundSet, selectedCountry);
  }, [foundSet, selectedCountry]);


  const getLabelColor = useCallback((d) => (
    REGION_COLORS[d.region] || (isLight ? "#d6a821" : "#eab308")
  ), [REGION_COLORS, isLight]);

  const getRingColor = useCallback(() => (
    isError ? '#ef4444' : (isLight ? 'rgba(37, 99, 235, 0.6)' : 'rgba(255, 255, 255, 0.5)')
  ), [isError, isLight]);

  return (
    <div 
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
          polygonSideColor={polygonSideColor}
          polygonStrokeColor={getPolygonStroke}
          polygonStrokeWidth={getPolygonStrokeWidth}
          polygonAltitudeUpdateMs={0}
          polygonsTransitionDuration={0}
          pointsData={markersData}
          pointLat="lat"
          pointLng="lng"
          pointColor={getPointColor}
          pointRadius={getPointRadius}
          pointAltitude={getPointAltitude}
          labelsData={labelsData}
          labelLat={d => d.lat}
          labelLng={d => d.lng}
          labelText={d => d.text}
          labelSize={0.6}
          labelDotRadius={0.35}
          labelColor={getLabelColor}
          labelResolution={viewport.width < 768 ? 1 : 2}
          labelAltitude={GLOBE_LAYER_ALTITUDE.selected}
          ringsData={ringsData}
          ringColor={getRingColor}
          ringMaxRadius={perfProfile?.isMobile ? 1.5 : 2.2}
          ringPropagationSpeed={perfProfile?.isMobile ? 0.75 : 1.2}
          ringRepeatPeriod={perfProfile?.isMobile ? 1300 : 1000}
          ringAltitude={GLOBE_LAYER_ALTITUDE.selected}
        />
    </div>
  );
};

export default React.memo(GlobeMap);
