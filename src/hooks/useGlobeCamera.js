import { useState, useEffect, useRef } from "react";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { DEPARTMENT_MODE_FRANCE_VIEW } from "../config/gameConfig";

const ORBIT_POLE_GUARD_ANGLE = 0.03;

const getDepartmentModeFrancePointOfView = (width) => ({
  lat: DEPARTMENT_MODE_FRANCE_VIEW.lat,
  lng: DEPARTMENT_MODE_FRANCE_VIEW.lng,
  altitude:
    width < 768
      ? DEPARTMENT_MODE_FRANCE_VIEW.altitude.mobile
      : DEPARTMENT_MODE_FRANCE_VIEW.altitude.desktop,
});

export function useGlobeCamera({
  globeEl,
  selectedCountry,
  shouldAutoRotate,
  viewport,
  isHomeScreen,
  isKeyboardMode,
  isEndScreen,
  isDepartmentMode,
  gameDataMap,
  perfProfile,
  setTransitioningPreviousCountryState,
  selectionTransitionStartRef,
  transitioningPreviousCountryRef,
}) {
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });

  const lastTargetRef = useRef(null);
  const wasHomeScreenRef = useRef(isHomeScreen);
  const isInteractingRef = useRef(false);
  const maxWindowWidthRef = useRef(window.innerWidth);
  const maxWindowHeightRef = useRef(window.innerHeight);
  const previousSelectedCountryRef = useRef(null);

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

          changeHandler = () => {
            if (isInteractingRef.current) return;
            if (globeEl.current) {
              const pov = globeEl.current.pointOfView();
              setZoomLevel((prev) => {
                if (Math.abs(prev - pov.altitude) > 0.08) return pov.altitude;
                return prev;
              });
              setCameraPOV((prev) => {
                const threshold = isHomeScreen ? 15 : 10;
                if (
                  Math.abs(prev.lat - pov.lat) > threshold ||
                  Math.abs(prev.lng - pov.lng) > threshold
                ) {
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

          controls.addEventListener("change", changeHandler);
          controls.addEventListener("start", startHandler);
          controls.addEventListener("end", endHandler);
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
          if (changeHandler)
            controlsReference.removeEventListener("change", changeHandler);
          if (startHandler)
            controlsReference.removeEventListener("start", startHandler);
          if (endHandler)
            controlsReference.removeEventListener("end", endHandler);
        } catch (e) {}
      }
    };
  }, [
    shouldAutoRotate,
    perfProfile?.pixelRatio,
    perfProfile?.isMobile,
    isHomeScreen,
    globeEl,
  ]);

  useEffect(() => {
    if (selectedCountry && globeEl.current) {
      const data =
        gameDataMap[selectedCountry] ||
        countryDataMap[selectedCountry] ||
        riversMountainsDataMap[selectedCountry];

      if (data && data.lat !== undefined) {
        const isMobile = viewport.width < 768;
        const currentPOV = globeEl.current.pointOfView();
        const hasPreviousSelection = !!previousSelectedCountryRef.current;
        const fallbackAltitude = isHomeScreen ? (isMobile ? 2.0 : 1.25) : (isMobile ? 1.8 : 0.68);
        const preservedAltitude =
          currentPOV && Number.isFinite(currentPOV.altitude)
            ? currentPOV.altitude
            : fallbackAltitude;
        const isKeyboardOpen = isMobile && isKeyboardMode;
        const layoutHeight = maxWindowHeightRef.current;
        const keyboardHeight = Math.max(0, layoutHeight - viewport.height);
        const keyboardRatio = keyboardHeight / layoutHeight;
        const bottomHUDRatio = isMobile ? 0.15 : 0;
        const occlusionRatio = isKeyboardOpen ? keyboardRatio : bottomHUDRatio;

        const visibleHeightDegrees = 36 * preservedAltitude;
        const latOffset = isHomeScreen ? 0 : -visibleHeightDegrees * (occlusionRatio * 0.7);

        const target = {
          lat: data.lat + latOffset,
          lng: data.lng,
          altitude: hasPreviousSelection
            ? (isHomeScreen ? fallbackAltitude : preservedAltitude)
            : Math.min(preservedAltitude, fallbackAltitude),
        };
        const previousTarget = lastTargetRef.current;
        const onlyViewportNudge =
          previousTarget &&
          previousSelectedCountryRef.current === selectedCountry &&
          Math.abs(previousTarget.lat - target.lat) < 0.001 &&
          Math.abs(previousTarget.lng - target.lng) < 0.001 &&
          Math.abs(previousTarget.altitude - target.altitude) < 0.001;
        const duration = isHomeScreen
          ? 1800
          : onlyViewportNudge
            ? 180
            : perfProfile?.isMobile ? 320 : 420;
        globeEl.current.pointOfView(target, duration);
        lastTargetRef.current = target;
      }
    } else if (isEndScreen && globeEl.current) {
      globeEl.current.pointOfView(
        isDepartmentMode
          ? getDepartmentModeFrancePointOfView(viewport.width)
          : { lat: 20, lng: 0, altitude: viewport.width < 768 ? 2.2 : 1.8 },
        1200,
      );
    } else if (isHomeScreen && globeEl.current) {
      const overviewAltitude = viewport.width < 768 ? 2.5 : 1;
      if (!wasHomeScreenRef.current) {
        const currentPOV = globeEl.current.pointOfView();
        globeEl.current.pointOfView(
          { lat: 18, lng: currentPOV?.lng ?? 20, altitude: overviewAltitude },
          1000,
        );
      } else {
        globeEl.current.pointOfView({ altitude: overviewAltitude }, 1000);
      }
    } else if (isDepartmentMode && globeEl.current) {
      globeEl.current.pointOfView(
        getDepartmentModeFrancePointOfView(viewport.width),
        700,
      );
    } else if (wasHomeScreenRef.current && globeEl.current) {
      globeEl.current.pointOfView(
        { lat: 18, lng: 20, altitude: viewport.width < 768 ? 1.8 : 1.35 },
        700,
      );
    }

    if (selectedCountry !== previousSelectedCountryRef.current) {
      if (transitioningPreviousCountryRef) {
        transitioningPreviousCountryRef.current = previousSelectedCountryRef.current;
      }
      if (setTransitioningPreviousCountryState) {
        setTransitioningPreviousCountryState(previousSelectedCountryRef.current);
      }
      if (selectionTransitionStartRef) {
        selectionTransitionStartRef.current = performance.now();
      }
    }
    wasHomeScreenRef.current = isHomeScreen;
    previousSelectedCountryRef.current = selectedCountry;
  }, [
    selectedCountry,
    viewport.width,
    viewport.height,
    viewport.top,
    isHomeScreen,
    perfProfile,
    isKeyboardMode,
    isEndScreen,
    isDepartmentMode,
    gameDataMap,
    globeEl,
    setTransitioningPreviousCountryState,
    selectionTransitionStartRef,
    transitioningPreviousCountryRef,
  ]);

  const isMobileSize = viewport.width < 1024;
  const isKeyboardLikelyOpening =
    isMobileSize &&
    window.innerHeight < maxWindowHeightRef.current * 0.85 &&
    window.innerWidth === maxWindowWidthRef.current;

  if (!isKeyboardLikelyOpening) {
    maxWindowWidthRef.current = window.innerWidth;
    maxWindowHeightRef.current = window.innerHeight;
  }

  const globeWidth = maxWindowWidthRef.current;
  const globeHeight = maxWindowHeightRef.current;
  const homeGlobeOffset =
    isHomeScreen && !isKeyboardMode && globeWidth >= 769
      ? Math.round(globeWidth * 0.18)
      : 0;
  const globeRenderWidth = globeWidth + homeGlobeOffset * 2;

  // Ensure reliable home overview camera + right-side positioning (for left UI card) when returning to accueil on desktop.
  // This recovers the movement animation and visual composition if the main selected effect didn't trigger it.
  useEffect(() => {
    if (isHomeScreen && globeEl.current) {
      const overviewAltitude = viewport.width < 768 ? 2.5 : 1.1;
      // Slight positive lng to bias the view nicely with left-padded UI (globe "on the right").
      globeEl.current.pointOfView(
        { lat: 16, lng: 28, altitude: overviewAltitude },
        950
      );
    }
  }, [isHomeScreen, globeEl, viewport.width]);

  return {
    zoomLevel,
    cameraPOV,
    maxWindowWidthRef,
    maxWindowHeightRef,
    getDepartmentModeFrancePointOfView,
    globeRenderWidth,
    globeHeight,
    homeGlobeOffset,
  };
}
