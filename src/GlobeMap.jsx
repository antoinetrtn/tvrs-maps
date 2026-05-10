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
  isHomeScreen
}) => {
  const globeEl = useRef();
  const tapRef = useRef(null);
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
        }

        const controls = globeEl.current.controls();
        if (controls) {
          controls.autoRotate = shouldAutoRotate;
          controls.autoRotateSpeed = 0.3;
          controls.enableZoom = true;
          controls.enableDamping = !perfProfile?.isMobile;
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
        const zoomAlt = isMobile ? 1.8 : 0.8;
        // To push the country UP on the screen (above the keyboard), 
        // we must point the camera slightly SOUTH of the country (negative offset).
        const isKeyboardOpen = isMobile && viewport.height < window.innerHeight * 0.85;
        const latOffset = isKeyboardOpen ? -25 : (isMobile ? -10 : 0);
        globeEl.current.pointOfView({ lat: data.lat + latOffset, lng: data.lng, altitude: zoomAlt }, perfProfile?.isMobile ? 250 : 400);
      }
    } else if (isHomeScreen && globeEl.current) {
      globeEl.current.pointOfView({ altitude: 2.5 }, 1000);
    }
  }, [selectedCountry, viewport.height, isHomeScreen, perfProfile]);

  const isLight = theme === 'light';

  const selectableCountriesData = useMemo(() => {
    return countriesData.filter(feature => countryDataMap[getFeatureAdmin(feature)]);
  }, [countriesData]);

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
    "Europe": isLight ? "rgba(37, 99, 235, 0.55)" : "rgba(59, 130, 246, 0.7)",
    "Americas": isLight ? "rgba(22, 163, 74, 0.55)" : "rgba(34, 197, 94, 0.7)",
    "Asia": isLight ? "rgba(220, 38, 38, 0.55)" : "rgba(239, 68, 68, 0.7)",
    "Africa": isLight ? "rgba(202, 138, 4, 0.55)" : "rgba(234, 179, 8, 0.7)",
    "Oceania": isLight ? "rgba(147, 51, 234, 0.55)" : "rgba(168, 85, 247, 0.7)",
    "Antarctic": isLight ? "rgba(160, 160, 160, 0.55)" : "rgba(200, 200, 200, 0.7)",
    "Unknown": isLight ? "rgba(80, 80, 80, 0.55)" : "rgba(100, 100, 100, 0.7)"
  }), [isLight]);

  const getPolygonColor = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (foundList.includes(admin)) {
      if (admin === selectedCountry) return 'rgba(34, 197, 94, 0.85)';
      const region = countryDataMap[admin]?.region;
      return REGION_COLORS[region] || 'rgba(34, 197, 94, 0.7)';
    }
    if (admin === selectedCountry) {
      if (isError) return 'rgba(239, 68, 68, 0.8)';
      return isLight ? 'rgba(37, 99, 235, 0.25)' : 'rgba(59, 130, 246, 0.25)'; 
    }
    if (mode === 'capitals') return isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(20, 30, 45, 0.2)';
    return isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(25, 40, 65, 0.5)';
  }, [selectedCountry, mode, foundList, REGION_COLORS, isLight, isError]);

  const getPolygonStroke = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (foundList.includes(admin)) return 'rgba(0,0,0,0)';
    if (admin === selectedCountry) {
      if (isError) return '#ef4444';
      return isLight ? '#1e40af' : '#ffffff';
    }
    return isLight ? 'rgba(30, 58, 138, 0.2)' : 'rgba(40, 70, 120, 0.4)';
  }, [selectedCountry, foundList, isLight, isError]);

  const getPolygonAltitude = useCallback((d) => {
    if (d.properties.ADMIN === selectedCountry) return 0.03; 
    return foundList.includes(d.properties.ADMIN) ? 0.015 : 0.008;
  }, [selectedCountry, foundList]);

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
    const shouldShowRing = selectedCountry && (!perfProfile?.isMobile || hasActiveFeedback);
    if (shouldShowRing) {
       const mapped = countryDataMap[selectedCountry];
       if (mapped && mapped.lat !== undefined) {
          return [{ lat: mapped.lat, lng: mapped.lng }];
       }
    }
    return [];
  }, [selectedCountry, perfProfile?.isMobile, hasActiveFeedback]);

  const globeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({ color: isLight ? '#a5c9f5' : '#0a1a3a' });
  }, [isLight]);

  const isMobileKeyboardOpen = viewport.width < 1024 && viewport.height < layoutViewportRef.current.height * 0.85;
  if (!isMobileKeyboardOpen) {
    layoutViewportRef.current = {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
  const globeWidth = layoutViewportRef.current.width;
  const globeHeight = layoutViewportRef.current.height;

  const polygonSideColor = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (admin === selectedCountry) {
      if (isError) return 'rgba(239, 68, 68, 0.5)';
      return isLight ? 'rgba(37, 99, 235, 0.3)' : 'rgba(59, 130, 246, 0.3)'; 
    }
    return isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.05)';
  }, [isLight, selectedCountry, isError]);

  const countriesWithGeometry = useMemo(() => {
    return new Set(selectableCountriesData.map(getFeatureAdmin));
  }, [selectableCountriesData]);

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
        top: 0, 
        left: 0, 
        width: globeWidth,
        height: globeHeight,
        zIndex: 0, 
        overflow: 'hidden',
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
          rendererConfig={{ antialias: false, powerPreference: 'high-performance' }}
          animateIn={false}
          enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
          polygonsData={selectableCountriesData}
          polygonCapCurvatureResolution={perfProfile?.polygonCapCurvatureResolution || 12}
          polygonAltitude={getPolygonAltitude}
          polygonCapColor={getPolygonColor}
          polygonSideColor={polygonSideColor}
          polygonStrokeColor={getPolygonStroke}
          polygonStrokeWidth={d => d.properties.ADMIN === selectedCountry ? 1.5 : 0.5}
          polygonAltitudeUpdateMs={0}
          polygonsTransitionDuration={0}
          pointsData={markersData}
          pointLat="lat"
          pointLng="lng"
          pointColor={d => {
            const isFound = foundList.includes(d.admin);
            const isSelected = d.admin === selectedCountry;
            if (isFound) return REGION_COLORS[d.region] || '#22c55e';
            if (isSelected) return isError ? '#ef4444' : (isLight ? '#3b82f6' : '#60a5fa');
            return isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
          }}
          pointRadius={d => d.admin === selectedCountry ? 0.4 : 0.2}
          pointAltitude={d => {
            if (d.admin === selectedCountry) return 0.03;
            return foundList.includes(d.admin) ? 0.015 : 0.005;
          }}
          onPointClick={d => selectCountry(d.admin)}
          labelsData={labelsData}
          labelLat={d => d.lat}
          labelLng={d => d.lng}
          labelText={d => d.text}
          labelSize={0.6}
          labelDotRadius={0.35}
          labelColor={d => (REGION_COLORS[d.region] || 'rgba(234, 179, 8, 0.7)').replace('0.7', '1').replace('0.55', '1')}
          labelResolution={viewport.width < 768 ? 1 : 2}
          labelAltitude={0.02}
          ringsData={ringsData}
          ringColor={() => isError ? '#ef4444' : (isLight ? 'rgba(37, 99, 235, 0.6)' : 'rgba(255, 255, 255, 0.5)')}
          ringMaxRadius={2.2}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={1000}
          ringAltitude={0.032}
          onPolygonClick={d => selectCountry(getFeatureAdmin(d))}
          onGlobeClick={({ lat, lng }) => selectCountryAtLngLat(lng, lat)}
        />
    </div>
  );
};

export default React.memo(GlobeMap);
