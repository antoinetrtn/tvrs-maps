import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { countryDataMap } from './gameData';

const GlobeMap = ({ mode, countriesData, foundList, onCountrySelect, isPaused, shouldAutoRotate, selectedCountry, theme, viewport, globeVisualTheme, hudSide, isError }) => {
  const globeEl = useRef();
  
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
        const controls = globeEl.current.controls();
        if (controls) {
          controls.autoRotate = shouldAutoRotate;
          controls.autoRotateSpeed = 0.3;
          controls.enableZoom = true;
        }

        const camera = globeEl.current.camera();
        if (camera) {
          const fullW = window.innerWidth;
          const fullH = window.innerHeight;

          if (fullW >= 1024) {
            // DESKTOP: Use offset to accommodate side HUD
            const horizontalOffset = hudSide === 'right' ? 160 : -160;
            camera.setViewOffset(fullW, fullH, horizontalOffset, 0, fullW, fullH);
          } else {
            // MOBILE: Clear offset, do NOT shift the camera.
            // This prevents the globe from resizing/glitching when the keyboard opens.
            // We handle centering by rotating the globe itself via latOffset.
            camera.clearViewOffset();
          }
        }
      } catch (e) {}
    }
  }, [shouldAutoRotate, hudSide, theme, globeVisualTheme]);

  useEffect(() => {
    if (selectedCountry && globeEl.current) {
      const data = countryDataMap[selectedCountry];
      if (data && data.lat !== undefined) {
        const isMobile = window.innerWidth < 768;
        const zoomAlt = isMobile ? 1.8 : 0.8;
        // To push the country UP on the screen (above the keyboard), 
        // we must point the camera slightly SOUTH of the country (negative offset).
        const isKeyboardOpen = isMobile && viewport.height < window.innerHeight * 0.85;
        const latOffset = isKeyboardOpen ? -25 : (isMobile ? -10 : 0);
        globeEl.current.pointOfView({ lat: data.lat + latOffset, lng: data.lng, altitude: zoomAlt }, 400);
      }
    }
  }, [selectedCountry, viewport.height]);

  const isLight = theme === 'light';
  const isSatellite = globeVisualTheme === 'satellite';

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
    if (isSatellite) return 'rgba(0,0,0,0)';
    if (mode === 'capitals') return isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(20, 30, 45, 0.2)';
    return isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(25, 40, 65, 0.5)';
  }, [selectedCountry, mode, foundList, REGION_COLORS, isLight, isSatellite, isError]);

  const getPolygonStroke = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (foundList.includes(admin)) return 'rgba(0,0,0,0)';
    if (admin === selectedCountry) {
      if (isError) return '#ef4444';
      return isLight ? '#1e40af' : '#ffffff';
    }
    if (isSatellite) return isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)';
    return isLight ? 'rgba(30, 58, 138, 0.2)' : 'rgba(40, 70, 120, 0.4)';
  }, [selectedCountry, foundList, isLight, isSatellite, isError]);

  const getPolygonAltitude = useCallback((d) => {
    if (d.properties.ADMIN === selectedCountry) return 0.03; 
    return foundList.includes(d.properties.ADMIN) ? 0.015 : 0.008;
  }, [selectedCountry, foundList]);

  const labelsData = useMemo(() => {
    return foundList
      .map(adminKey => countryDataMap[adminKey])
      .filter(data => data && data.lat !== undefined)
      .map(data => ({
        id: data.iso2 || data.capital,
        lat: data.lat,
        lng: data.lng,
        text: data.capital_fr || data.capital,
        region: data.region
      }));
  }, [foundList]);

  const ringsData = useMemo(() => {
    if (selectedCountry) {
       const mapped = countryDataMap[selectedCountry];
       if (mapped && mapped.lat !== undefined) {
          return [{ lat: mapped.lat, lng: mapped.lng }];
       }
    }
    return [];
  }, [selectedCountry]);

  const globeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({ color: isLight ? '#a5c9f5' : '#0a1a3a' });
  }, [isLight]);

  const polygonSideColor = useCallback((d) => {
    const admin = d.properties.ADMIN;
    if (admin === selectedCountry) {
      if (isError) return 'rgba(239, 68, 68, 0.5)';
      return isLight ? 'rgba(37, 99, 235, 0.3)' : 'rgba(59, 130, 246, 0.3)'; 
    }
    return isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.05)';
  }, [isLight, selectedCountry, isError]);

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={(e) => {
        // If clicking the canvas (globe), prevent default to keep the keyboard open
        if (e.target.tagName === 'CANVAS') {
          e.preventDefault();
        }
      }}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
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
          width={window.innerWidth}
          height={window.innerHeight}
          globeImageUrl={isSatellite ? "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg" : null}
          globeMaterial={isSatellite ? null : globeMaterial}
          backgroundImageUrl={!isLight ? "//unpkg.com/three-globe/example/img/night-sky.png" : null}
          showAtmosphere={(isSatellite || isLight) && window.innerWidth >= 768} // Disable heavy atmosphere shader on mobile to fix heating
          atmosphereColor={isLight ? "#b0e2ff" : "#3a76f0"}
          atmosphereDayQuotient={isLight ? 0.2 : 0.1}
          backgroundColor="rgba(0,0,0,0)"
          lineHoverPrecision={0}
          rendererConfig={{ antialias: false, powerPreference: 'high-performance' }}
          polygonsData={countriesData}
          polygonResolution={1}
          polygonAltitude={getPolygonAltitude}
          polygonCapColor={getPolygonColor}
          polygonSideColor={polygonSideColor}
          polygonStrokeColor={getPolygonStroke}
          polygonStrokeWidth={d => d.properties.ADMIN === selectedCountry ? 1.5 : 0.5}
          polygonAltitudeUpdateMs={0}
          polygonsTransitionDuration={0}
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
          onPolygonClick={d => {
            const admin = d.properties.ADMIN;
            if (onCountrySelect) onCountrySelect(admin);
          }}
        />
    </div>
  );
};

export default React.memo(GlobeMap);
