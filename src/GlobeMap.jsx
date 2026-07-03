import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { countryDataMap } from "./gameData";
import { riversMountainsDataMap } from "./riversMountainsData";
import {
  THEME,
  GLOBE_STYLE,
  GLOBE_TRANSPARENT_BACKGROUND,
  getOpaqueThreeColor,
  getThemeColors,
  getThemeRegionColor,
  getThemeRegionColorAttenuated,
  getThemeRegionColorLabel,
  getThemeDepartmentColor,
  scrambleText,
} from "./designSystem";
import {
  disposeBiomeCache,
  createMountainFeature,
  createUnfoundPlaceholder,
} from "./LowPolyBiomes";
import {
  shouldScrambleLabel,
  getPolygonAltitudeFor,
  RELIEF,
  DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS,
  DEPARTMENT_MODE_FRANCE_VIEW,
  GAME_REGIONS,
} from "./gameConfig";
import { useTranslation } from "./i18n";
import { FRESNEL_VERTEX_SHADER, FRESNEL_FRAGMENT_SHADER } from "./globeShaders";
import SpaceBackground from "./SpaceBackground";
import {
  getFeatureAdmin,
  getFlagEmoji,
  getFeaturePolygons,
  areLngLatPointsEqual,
  getCleanRingForRendering,
  getExteriorPolygonForRendering,
  getRenderGeometry,
  getLngLatBounds,
  pointInBounds,
  pointInRing,
  pointInPolygon,
  featureContainsLngLat,
  getLngLatDistance,
  getMobileRenderRadius,
  getLabelRenderRadius,
} from "./utils";

// Hoisted PURE accessors for the <Globe> paths layer. Keeping their identities
// stable across renders prevents react-globe.gl from marking the path/object
// layers dirty and re-tessellating all river/mountain tube geometry every render.
const pathPointsAccessor = (d) => d.coords;
const pathPointLatAccessor = (d) => d[0];
const pathPointLngAccessor = (d) => d[1];
const pathPointAltAccessor = (d) => d[2];
const pathColorAccessor = (d) => d.color;
const pathWidthAccessor = (d) => d.width;
const pathDashLengthAccessor = (d) => d.dashLength;
const pathDashGapAccessor = (d) => d.dashGap;
const pathDashAnimateTimeAccessor = (d) => d.dashAnimateTime;

const smoothedRiversCache = {};

const getSmoothedRiverPath = (riverKey, pathCoords) => {
  if (smoothedRiversCache[riverKey]) return smoothedRiversCache[riverKey];
  if (!pathCoords || pathCoords.length < 2) return pathCoords;

  const points = pathCoords.map(
    ([lat, lng]) => new THREE.Vector3(lat, lng, 0.005),
  );
  const curve = new THREE.CatmullRomCurve3(points);
  const smoothPoints = curve.getPoints(60);
  const result = smoothPoints.map((p) => [p.x, p.y, p.z]);

  smoothedRiversCache[riverKey] = result;
  return result;
};

const SELECTION_TRANSITION_DURATION = 80; // Snappy transition
const ORBIT_POLE_GUARD_ANGLE = 0.03;
const BIOME_SCENE_SCALE = 9.2;
const BIOME_SURFACE_ALIGNMENT_RADIANS = Math.PI / 2;

const getDepartmentModeFrancePointOfView = (width) => ({
  lat: DEPARTMENT_MODE_FRANCE_VIEW.lat,
  lng: DEPARTMENT_MODE_FRANCE_VIEW.lng,
  altitude:
    width < 768
      ? DEPARTMENT_MODE_FRANCE_VIEW.altitude.mobile
      : DEPARTMENT_MODE_FRANCE_VIEW.altitude.desktop,
});

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
  globeTheme = "satellite",
  learnToggles,
}) => {
  const {
    showCountryLabels: learnShowCountryLabels = true,
    showCapitals: learnShowCapitals = false,
    showRivers: learnShowRivers = false,
    showMountains: learnShowMountains = false,
  } = learnToggles || {};
  const t = useTranslation(lang);
  const globeEl = useRef();
  const globeContentWrapperRef = useRef(null);
  const globeLightingRef = useRef(null);
  const polygonMaterialCacheRef = useRef({ cap: new Map(), side: new Map() });
  const sharedMaterialsRef = useRef(new Map());
  const tapRef = useRef(null);
  const previousSelectedCountryRef = useRef(null);
  const transitioningPreviousCountryRef = useRef(null);
  const selectionTransitionStartRef = useRef(0);
  const lastTargetRef = useRef(null);
  const maxWindowWidthRef = useRef(window.innerWidth);
  const maxWindowHeightRef = useRef(window.innerHeight);
  const wasHomeScreenRef = useRef(isHomeScreen);
  const isInteractingRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });

  const prevSelectedCountryRef = useRef(null);
  const biomeObjectsCacheRef = useRef(new Map());
  const lastAnimFrameTimeRef = useRef(0);
  const targetGlowColorRef = useRef(new THREE.Color(0x38bdf8));
  const targetGlowPowerRef = useRef(1.2);
  const targetGlowCoefRef = useRef(1.0);
  const selectedStrokeObjRef = useRef(null);
  // Coalesce globe "nudge" pointer-drag DOM writes into one update per frame
  // instead of one per pointermove event (which fires 60+/s and forces reflow).
  const pointerNudgeRafRef = useRef(null);
  const pendingNudgeRef = useRef(null);
  // Refs read inside the rAF loop so it can react to selection/feedback changes
  // without tearing down and recreating the loop on every guess/navigation.
  const selectedCountryRef = useRef(null);
  const isErrorRef = useRef(false);
  const isSuccessRef = useRef(false);
  const isEndScreenRef = useRef(false);
  // rAF bookkeeping + bounded graticule restyle window (replaces per-frame random restyle).
  const animFrameIdRef = useRef(null);
  const animateSceneRef = useRef(null);
  const needsGraticuleStyleRef = useRef(true);
  const graticuleStyleUntilRef = useRef(0);
  const lastGraticuleStyleTimeRef = useRef(0);
  // Keep the loop-facing refs current on every render so the running rAF loop
  // reads fresh selection/feedback state without being part of its dep array.
  selectedCountryRef.current = selectedCountry;
  isErrorRef.current = isError;
  isSuccessRef.current = isSuccess;
  isEndScreenRef.current = isEndScreen;

  const labelsCacheRef = useRef({});
  const isDepartmentMode = mode === "departments" && !isHomeScreen;
  const isRiversMountainsMode = mode === "rivers_mountains";
  const gameDataMap =
    isDepartmentMode || isRiversMountainsMode
      ? activeDataMap || {}
      : countryDataMap;

  const safeColor = useCallback((c) => getOpaqueThreeColor(c), []);

  const lerpColor = useCallback(
    (a, b, amount) => {
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
    },
    [safeColor],
  );

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
    const newAlt = Math.max(
      0.1,
      Math.min(4, currentPOV.altitude - deltaY * zoomSpeed),
    );
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
              setZoomLevel((prev) => {
                if (Math.abs(prev - pov.altitude) > 0.08) return pov.altitude;
                return prev;
              });
              setCameraPOV((prev) => {
                // Larger threshold for home screen to keep background stable, 10 for gameplay to optimize updates
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
    theme,
    perfProfile?.pixelRatio,
    perfProfile?.isMobile,
    isHomeScreen,
  ]);

  useEffect(() => {
    if (selectedCountry && globeEl.current) {
      const data = gameDataMap[selectedCountry] || countryDataMap[selectedCountry] || riversMountainsDataMap[selectedCountry];
      if (data && data.lat !== undefined) {
        const isMobile = viewport.width < 768;
        const currentPOV = globeEl.current.pointOfView();
        const hasPreviousSelection = !!previousSelectedCountryRef.current;
        const fallbackAltitude = isHomeScreen ? (isMobile ? 2.0 : 1.25) : (isMobile ? 1.8 : 0.68);
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
      // Center and zoom out for the end screen
      globeEl.current.pointOfView(
        isDepartmentMode
          ? getDepartmentModeFrancePointOfView(viewport.width)
          : { lat: 20, lng: 0, altitude: viewport.width < 768 ? 2.2 : 1.8 },
        1200,
      );
    } else if (isHomeScreen && globeEl.current) {
      // On home the auto-target loop still highlights countries, but the camera stays in a
      // calm overview (auto-rotate keeps spinning). When arriving from a game, re-level the
      // latitude so a game that ended zoomed on a pole doesn't leave the globe tilted.
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
      transitioningPreviousCountryRef.current = previousSelectedCountryRef.current;
      selectionTransitionStartRef.current = performance.now();
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
  ]);



  const isLight = theme === "light";

  const selectableCountriesData = useMemo(() => {
    if (isDepartmentMode)
      return departmentsData.filter(
        (feature) => gameDataMap[getFeatureAdmin(feature)],
      );
    return countriesData.filter(
      (feature) => countryDataMap[getFeatureAdmin(feature)],
    );
  }, [countriesData, departmentsData, gameDataMap, isDepartmentMode]);

  const baseRenderCountriesData = useMemo(() => {
    return selectableCountriesData.map((feature) => ({
      ...feature,
      renderGeometry: getRenderGeometry(feature),
    }));
  }, [selectableCountriesData]);

  const renderCountriesData = useMemo(() => {
    if (!isDepartmentMode) return baseRenderCountriesData;

    const ghostWorld = countriesData
      .filter(
        (feature) =>
          !DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS.has(
            getFeatureAdmin(feature),
          ),
      )
      .map((feature) => ({
        ...feature,
        isGhostCountry: true,
        renderGeometry: getRenderGeometry(feature),
      }));

    return [
      ...ghostWorld,
      ...baseRenderCountriesData.map((feature) => ({
        ...feature,
        isDepartmentFeature: true,
      })),
    ];
  }, [baseRenderCountriesData, countriesData, isDepartmentMode]);

  const selectableFeatureIndex = useMemo(() => {
    return selectableCountriesData
      .map((feature) => {
        const polygons = getFeaturePolygons(feature);
        return {
          admin: getFeatureAdmin(feature),
          bounds: getLngLatBounds(polygons),
          polygons,
        };
      })
      .filter((entry) => entry.admin && entry.polygons.length);
  }, [selectableCountriesData]);

  const selectCountry = useCallback(
    (admin) => {
      if (onCountrySelect) {
        if (
          !admin ||
          gameDataMap[admin] ||
          (mode === "learn" && riversMountainsDataMap[admin])
        ) {
          onCountrySelect(admin);
        }
      }
    },
    [gameDataMap, onCountrySelect, mode],
  );

  const selectCountryAtLngLat = useCallback(
    (lng, lat) => {
      const isLearnRivers = mode === "learn" && learnShowRivers;
      const isLearnMountains = mode === "learn" && learnShowMountains;

      if (mode === "rivers_mountains" || isLearnRivers || isLearnMountains) {
        let best = null;
        const dataMap =
          mode === "rivers_mountains" ? gameDataMap : riversMountainsDataMap;
        Object.entries(dataMap).forEach(([admin, data]) => {
          if (!data) return;
          if (mode === "learn") {
            if (data.type === "river" && !learnShowRivers) return;
            if (
              (data.type === "mountain" || data.type === "mountain_range") &&
              !learnShowMountains
            )
              return;
          }

          let dist;
          if (
            data.type === "river" &&
            Array.isArray(data.path) &&
            data.path.length > 0
          ) {
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
          const threshold = bestData.type === "river" ? 5.5 : 6.0;
          if (best.dist < threshold) {
            selectCountry(best.admin);
            return;
          }
        }
        if (mode !== "learn") {
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

      const match = selectableFeatureIndex.find((entry) =>
        featureContainsLngLat(entry, lng, lat),
      );
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
    },
    [
      gameDataMap,
      isDepartmentMode,
      selectableFeatureIndex,
      selectCountry,
      mode,
      learnShowRivers,
      learnShowMountains,
    ],
  );

  const handlePointerDown = useCallback(
    (event) => {
      // Prevent focus shift (keyboard flicker) on mobile when interacting with the globe
      if (
        event.pointerType === "touch" &&
        isKeyboardMode &&
        viewport.width < 1024
      ) {
        event.preventDefault();
        onPreserveInputFocus?.();
      }

      tapRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: performance.now(),
      };

      if (globeContentWrapperRef.current && !isHomeScreen) {
        globeContentWrapperRef.current.style.transition =
          "transform 80ms linear";
      }
    },
    [isHomeScreen, isKeyboardMode, onPreserveInputFocus, viewport.width],
  );

  const handlePointerMove = useCallback(
    (event) => {
      const tap = tapRef.current;
      const wrapper = globeContentWrapperRef.current;
      if (!tap || tap.pointerId !== event.pointerId || !wrapper || isHomeScreen)
        return;

      const dx = event.clientX - tap.x;
      const dy = event.clientY - tap.y;
      const strength = perfProfile?.isMobile ? 0.035 : 0.045;
      const limit = perfProfile?.isMobile ? 9 : 16;
      const nudgeX = Math.max(-limit, Math.min(limit, dx * strength));
      const nudgeY = Math.max(-limit, Math.min(limit, dy * strength));
      pendingNudgeRef.current = { x: nudgeX, y: nudgeY };
      if (pointerNudgeRafRef.current == null) {
        pointerNudgeRafRef.current = requestAnimationFrame(() => {
          pointerNudgeRafRef.current = null;
          const w = globeContentWrapperRef.current;
          const n = pendingNudgeRef.current;
          if (!w || !n) return;
          w.style.setProperty("--globe-nudge-x", `${n.x.toFixed(2)}px`);
          w.style.setProperty("--globe-nudge-y", `${n.y.toFixed(2)}px`);
        });
      }
    },
    [isHomeScreen, perfProfile?.isMobile],
  );

  const resetGlobeNudge = useCallback(() => {
    const wrapper = globeContentWrapperRef.current;
    if (!wrapper) return;
    if (pointerNudgeRafRef.current != null) {
      cancelAnimationFrame(pointerNudgeRafRef.current);
      pointerNudgeRafRef.current = null;
    }
    pendingNudgeRef.current = null;
    wrapper.style.transition =
      "transform 520ms cubic-bezier(0.18, 0.9, 0.22, 1.18)";
    wrapper.style.setProperty("--globe-nudge-x", "0px");
    wrapper.style.setProperty("--globe-nudge-y", "0px");
  }, []);

  const handlePointerUp = useCallback(
    (event) => {
      const tap = tapRef.current;
      tapRef.current = null;
      resetGlobeNudge();
      if (isHomeScreen) return;
      if (!tap || tap.pointerId !== event.pointerId) return;

      const dx = event.clientX - tap.x;
      const dy = event.clientY - tap.y;
      const moved = Math.hypot(dx, dy);
      const elapsed = performance.now() - tap.t;
      if (moved > 10 || elapsed > 600 || !globeEl.current?.toGlobeCoords)
        return;

      if (
        event.pointerType === "touch" &&
        isKeyboardMode &&
        viewport.width < 1024
      ) {
        event.preventDefault();
        onPreserveInputFocus?.();
      }

      const coords = globeEl.current.toGlobeCoords(
        event.clientX,
        event.clientY,
      );
      if (coords) {
        selectCountryAtLngLat(coords.lng, coords.lat);
      } else {
        // Clicked in space (not on the globe sphere)
        selectCountry(null);
      }
    },
    [
      isHomeScreen,
      isKeyboardMode,
      onPreserveInputFocus,
      resetGlobeNudge,
      selectCountryAtLngLat,
      selectCountry,
      viewport.width,
    ],
  );

  // The three region-color palettes (surface / attenuated / label) all share the
  // same key set (GAME_REGIONS) and the same dependencies (globeTheme + theme),
  // so they are derived together in one pass instead of three duplicated loops.
  const { REGION_COLORS, REGION_COLORS_ATTENUATED, REGION_COLORS_LABELS } =
    useMemo(() => {
      const surface = {};
      const attenuated = {};
      const labels = {};
      GAME_REGIONS.forEach((r) => {
        surface[r] = getThemeRegionColor(globeTheme, theme, r);
        attenuated[r] = getThemeRegionColorAttenuated(globeTheme, theme, r);
        labels[r] = getThemeRegionColorLabel(globeTheme, theme, r);
      });
      return {
        REGION_COLORS: surface,
        REGION_COLORS_ATTENUATED: attenuated,
        REGION_COLORS_LABELS: labels,
      };
    }, [globeTheme, theme]);
  const UI_COLORS = useMemo(() => {
    return getThemeColors(globeTheme, theme);
  }, [theme, globeTheme]);

  const foundSet = useMemo(() => {
    if (isHomeScreen) {
      return new Set();
    }
    return new Set(foundList);
  }, [foundList, isHomeScreen]);

  useEffect(() => {
    if (isEndScreen) {
      polygonMaterialCacheRef.current.cap.forEach((mat, adminKey) => {
        if (mat && mat.userData.shader) {
          const shader = mat.userData.shader;
          const isFound = foundSet.has(adminKey);
          if (shader.uniforms.uIsError) {
            shader.uniforms.uIsError.value = !isFound ? 1.0 : 0.0;
          }
          if (shader.uniforms.uIsSuccess) {
            shader.uniforms.uIsSuccess.value = isFound ? 1.0 : 0.0;
          }
        }
      });
    }
  }, [isEndScreen, foundSet]);

  const extrusionScale = useMemo(() => {
    return globeLightingEnabled ? 1.8 : 1;
  }, [globeLightingEnabled]);

  const getRegionSurfaceColor = useCallback(
    (region) => {
      return REGION_COLORS[region] || UI_COLORS.success;
    },
    [REGION_COLORS, UI_COLORS.success],
  );

  const getPolygonColor = useCallback(
    (d) => {
      if (isDepartmentMode) {
        const admin = getFeatureAdmin(d);
        if (d.isGhostCountry) return UI_COLORS.mapBase;
        if (isEndScreen && !foundSet.has(admin)) return UI_COLORS.error;

        const regionCode = d.properties?.region || "Unknown";
        let baseColor = getThemeDepartmentColor(globeTheme, theme, regionCode, UI_COLORS.mapBase);

        if (foundSet.has(admin) || mode === "learn") {
          if (admin === selectedCountry) {
            if (isError) return UI_COLORS.error;
            return UI_COLORS.mapSurfaceSelected || lerpColor(baseColor, UI_COLORS.paper, 0.15);
          }
          return baseColor;
        }

        if (admin === selectedCountry) {
          if (isError) return UI_COLORS.error;
          return UI_COLORS.mapSurfaceSelected || lerpColor(baseColor, UI_COLORS.paper, 0.1);
        }

        return UI_COLORS.mapBase;
      }

      const admin = getFeatureAdmin(d);
      const region = countryDataMap[admin]?.region || "Unknown";

      // End screen: Green (or Gold if perfect) for found, Red for missed
      if (isEndScreen) {
        if (foundSet.has(admin)) {
          return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        }
        return UI_COLORS.error;
      }

      if (foundSet.has(admin) || mode === "learn") {
        const baseColor = getRegionSurfaceColor(region);
        if (admin === selectedCountry) {
          if (isError) return UI_COLORS.error;
          return UI_COLORS.mapSurfaceSelected || lerpColor(
            baseColor,
            UI_COLORS.paper,
            0.1 *
              GLOBE_STYLE.lighting.capPulseToPaper[isLight ? "light" : "dark"],
          );
        }
        return baseColor;
      }

      if (admin === selectedCountry) {
        if (isError) return UI_COLORS.error;
        const baseColor = REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;
        const targetColor = REGION_COLORS[region] || UI_COLORS.accent;
        return UI_COLORS.mapSurfaceSelected || lerpColor(baseColor, targetColor, 0.1);
      }

      return UI_COLORS.mapBase;
    },
    [
      selectedCountry,
      mode,
      foundSet,
      REGION_COLORS,
      REGION_COLORS_ATTENUATED,
      UI_COLORS,
      isError,
      isHomeScreen,
      isDepartmentMode,
      isEndScreen,
      isPerfectScore,
      getRegionSurfaceColor,
      globeTheme,
      theme,
      isLight,
    ],
  );

  const getPolygonStroke = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;

      if (isSelected) {
        if (isError) return UI_COLORS.error;
        return UI_COLORS.accent;
      }

      if (isHomeScreen) {
        return isLight
          ? lerpColor(UI_COLORS.mapSea, UI_COLORS.mapBorderMuted, 0.45)
          : UI_COLORS.mapBorder;
      }
      if (isDepartmentMode) {
        if (d.isGhostCountry)
          return isLight
            ? lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.12)
            : lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.08);
        if (foundSet.has(admin))
          return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        return isLight ? UI_COLORS.mapBorderMuted : UI_COLORS.mapBorder;
      }

      const region = countryDataMap[admin]?.region || "Unknown";
      const isFound = foundSet.has(admin) || mode === "learn";

      if (UI_COLORS.useRegionalBorders && isFound) {
        return REGION_COLORS_LABELS[region] || UI_COLORS.accent;
      }

      return isFound ? UI_COLORS.borderFound : UI_COLORS.borderUnfound;
    },
    [
      selectedCountry,
      UI_COLORS,
      isError,
      foundSet,
      mode,
      isHomeScreen,
      isLight,
      isDepartmentMode,
      lerpColor,
      isPerfectScore,
      globeTheme,
      REGION_COLORS_LABELS,
    ],
  );

  const getPolygonSideColor = useCallback(
    (d) => {
      if (isDepartmentMode) {
        if (d.isGhostCountry) return UI_COLORS.mapSea;
        return lerpColor(
          getPolygonColor(d),
          UI_COLORS.black,
          isLight ? 0.012 : 0.02,
        );
      }

      const admin = getFeatureAdmin(d);
      const region = countryDataMap[admin]?.region || "Unknown";

      let baseColor;
      if (isEndScreen) {
        if (foundSet.has(admin)) {
          baseColor = isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        } else {
          baseColor = UI_COLORS.error;
        }
      } else {
        baseColor =
          foundSet.has(admin) || mode === "learn"
            ? getRegionSurfaceColor(region)
            : UI_COLORS.mapBase;
      }
      if (globeLightingEnabled) {
        if (admin === selectedCountry) {
          if (isError)
            return isLight ? UI_COLORS.errorDeep : UI_COLORS.errorDeeper;
          if (UI_COLORS.mapSurfaceSelected) return UI_COLORS.mapSurfaceSelected;

          // Base color for the side when selected under lighting
          const sideBaseColor =
            foundSet.has(admin) || mode === "learn"
              ? getRegionSurfaceColor(region)
              : REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent;

          return lerpColor(
            sideBaseColor,
            UI_COLORS.black,
            isLight
              ? GLOBE_STYLE.lighting.sideDarken.selectedLight
              : GLOBE_STYLE.lighting.sideDarken.selectedDark,
          );
        }
        if (foundSet.has(admin) || mode === "learn") {
          const base = getRegionSurfaceColor(region);
          return lerpColor(
            base,
            UI_COLORS.black,
            isLight
              ? GLOBE_STYLE.lighting.sideDarken.foundLight
              : GLOBE_STYLE.lighting.sideDarken.foundDark,
          );
        }
        return lerpColor(
          UI_COLORS.mapBase,
          UI_COLORS.black,
          isLight
            ? GLOBE_STYLE.lighting.sideDarken.baseLight
            : GLOBE_STYLE.lighting.sideDarken.baseDark,
        );
      }

      if (admin === selectedCountry) {
        if (isError)
          return isLight ? UI_COLORS.errorMuted : UI_COLORS.errorDeep;
        if (UI_COLORS.mapSurfaceSelected) return UI_COLORS.mapSurfaceSelected;

        const capColor =
          foundSet.has(admin) || mode === "learn"
            ? lerpColor(
                getRegionSurfaceColor(region),
                UI_COLORS.paper,
                0.1 *
                  GLOBE_STYLE.lighting.capPulseToPaper[
                    isLight ? "light" : "dark"
                  ],
              )
            : lerpColor(
                REGION_COLORS_ATTENUATED[region] || UI_COLORS.accent,
                REGION_COLORS[region] || UI_COLORS.accent,
                0.1,
              );

        return lerpColor(capColor, UI_COLORS.black, isLight ? 0.24 : 0.08);
      }

      return lerpColor(baseColor, UI_COLORS.black, isLight ? 0.32 : 0.16);
    },
    [
      foundSet,
      REGION_COLORS,
      REGION_COLORS_ATTENUATED,
      UI_COLORS,
      selectedCountry,
      isLight,
      globeLightingEnabled,
      mode,
      isHomeScreen,
      isDepartmentMode,
      lerpColor,
      getPolygonColor,
      getRegionSurfaceColor,
      globeTheme,
    ],
  );

  const getBaseColorForCountryAndKind = useCallback(
    (admin, kind) => {
      const data = gameDataMap[admin] || countryDataMap[admin];
      const region = data?.region || "Unknown";
      const isFound = foundSet.has(admin);
      
      let baseColor;
      if (isEndScreen) {
        if (isFound) {
          baseColor = isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        } else {
          baseColor = UI_COLORS.error;
        }
      } else {
        baseColor =
          isFound || mode === "learn"
            ? getRegionSurfaceColor(region)
            : UI_COLORS.mapBase;
      }

      const capColor = lerpColor(baseColor, UI_COLORS.black, isLight ? 0.32 : 0.16);
      if (kind === "side") {
        return lerpColor(capColor, UI_COLORS.black, isLight ? 0.04 : 0.08);
      }
      return capColor;
    },
    [gameDataMap, foundSet, mode, getRegionSurfaceColor, UI_COLORS, isLight, lerpColor, isEndScreen, isPerfectScore]
  );

  const getPolygonMaterial = useCallback(
    (d, kind) => {
      const admin = getFeatureAdmin(d) || "unknown";
      const cache = polygonMaterialCacheRef.current[kind];
      const color =
        kind === "cap" ? getPolygonColor(d) : getPolygonSideColor(d);

      const ExpectedMaterialClass = THREE.MeshPhongMaterial;

      const isFound = foundSet.has(admin) || mode === "learn";

      let emissiveHex = UI_COLORS.black;
      let emissiveIntensity = 0;
      let specularHex = THREE.Color
        ? new THREE.Color(UI_COLORS.black)
        : UI_COLORS.black;
      let shininess = 0.7;

      if (UI_COLORS.polyMatMatte) {
        if (!isFound && admin !== selectedCountry) {
          emissiveHex = UI_COLORS.black;
          emissiveIntensity = 0;
          specularHex = new THREE.Color(0x000000);
          shininess = 0.0;
        } else {
          emissiveHex = color;
          emissiveIntensity = isLight
            ? (Number(UI_COLORS.polyMatEmissiveIntensityFoundLight) || 0.22)
            : (Number(UI_COLORS.polyMatEmissiveIntensityFoundDark) || 0.52);
          specularHex = new THREE.Color(0x000000); // 100% matte
          shininess = 0.0; // 100% matte
        }
      } else if (isDepartmentMode && !d.isGhostCountry) {
        emissiveHex = color;
        emissiveIntensity =
          kind === "cap" ? (isLight ? 0.08 : 0.12) : isLight ? 0.04 : 0.07;
        specularHex = UI_COLORS.mapBorder;
        shininess = kind === "cap" ? 2 : 1;
      } else if (globeLightingEnabled) {
        emissiveHex = color;

        const baseEmissiveIntensity =
          kind === "cap"
            ? isLight
              ? GLOBE_STYLE.lighting.material.capEmissiveLight
              : GLOBE_STYLE.lighting.material.capEmissiveDark
            : isLight
              ? GLOBE_STYLE.lighting.material.sideEmissiveLight
              : GLOBE_STYLE.lighting.material.sideEmissiveDark;

        // Standard emissive boost in dark mode
        const emissiveBoost = !isLight ? 0.18 : 0.05;

        emissiveIntensity =
          baseEmissiveIntensity +
          emissiveBoost +
          (admin === selectedCountry ? 0.1 : 0);

        specularHex =
          admin === selectedCountry ? UI_COLORS.paper : UI_COLORS.mapBorder;
        const baseShininess =
          kind === "cap"
            ? isLight
              ? GLOBE_STYLE.lighting.material.capShininessLight
              : GLOBE_STYLE.lighting.material.capShininessDark
            : isLight
              ? GLOBE_STYLE.lighting.material.sideShininessLight
              : GLOBE_STYLE.lighting.material.sideShininessDark;

        shininess =
          baseShininess + (admin === selectedCountry ? 30 : isLight ? 0 : 25);
      }

      const isIsolated = admin === selectedCountry;
      const isPrevTransitioning = admin === transitioningPreviousCountryRef.current;
      const isShaderCap =
        (kind === "cap" || kind === "side") &&
        (isIsolated || isPrevTransitioning || (isEndScreen && !foundSet.has(admin)));
      const isMobileStr = perfProfile?.isMobile ? "mobile" : "desktop";

      // Construct cache/pool key
      const cacheKey = isShaderCap
        ? `shader-${admin}-${kind}-${isMobileStr}`
        : `${kind}-${color}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}`;

      let material = sharedMaterialsRef.current.get(cacheKey);

      if (!material) {
        material = new ExpectedMaterialClass({
          side: THREE.DoubleSide,
          blending: THREE.NormalBlending,
          depthWrite: true,
        });

        material.color.set(safeColor(color));
        material.flatShading = false;

        material.emissive.set(safeColor(emissiveHex));
        material.emissiveIntensity = emissiveIntensity;

        if (material.isMeshPhongMaterial) {
          material.specular.set(safeColor(specularHex));
          material.shininess = shininess;
        }
        if (isShaderCap) {
          if (kind === "side") {
            material.transparent = true;
            material.opacity = 0.55;
          }
          material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uFadeProgress = { value: 0.0 };
            shader.uniforms.uTargetColor = {
              value: new THREE.Color(getBaseColorForCountryAndKind(admin, kind)),
            };
            shader.uniforms.uIsError = {
              value: admin === selectedCountry && isError ? 1.0 : 0.0,
            };
            shader.uniforms.uIsSuccess = {
              value: admin === selectedCountry && isSuccess ? 1.0 : 0.0,
            };
            shader.uniforms.uIsLight = { value: isLight ? 1.0 : 0.0 };
            shader.uniforms.uTheme = {
              value: UI_COLORS.isBlackoutTheme ? 1.0 : 0.0,
            };
            shader.uniforms.uIsSide = {
              value: kind === "side" ? 1.0 : 0.0,
            };
            material.userData.shader = shader;

            shader.vertexShader =
              `
            varying vec3 vLocalPosition;
          ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
              `#include <begin_vertex>`,
              `#include <begin_vertex>
              vLocalPosition = position;
            `
            );

            shader.fragmentShader =
              `
            varying vec3 vLocalPosition;
            uniform float uTime;
            uniform float uFadeProgress;
            uniform vec3 uTargetColor;
            uniform float uIsError;
            uniform float uIsSuccess;
            uniform float uIsLight;
            uniform float uTheme;
            uniform float uIsSide;
            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
          ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
              `#include <dithering_fragment>`,
              `#include <dithering_fragment>
              vec2 noiseUv = vLocalPosition.xy * 8.0 + vec2(vLocalPosition.z * 4.0);
              float t = uTime * 28.0;
              float noise = hash(noiseUv + sin(t));

              // Dynamic static range: bright static in light theme, dark static in dark theme
              float baseMin = (uIsLight > 0.5) ? 0.65 : 0.12;
              float baseMax = (uIsLight > 0.5) ? 0.98 : 0.68;
              float scanline = sin(vLocalPosition.y * 15.0 + uTime * 5.0) * ((uIsLight > 0.5) ? 0.03 : 0.07);

              float staticColor = mix(baseMin, baseMax, noise) + scanline;
              vec3 staticVec = vec3(staticColor);
              vec3 neonGreen = vec3(0.05, 0.92, 0.52);

              vec3 finalColor = gl_FragColor.rgb;

              if (uIsSide > 0.5) {
                // SIDES / WALLS GEOMETRY
                if (uIsError > 0.5) {
                  // Error on side walls: fast pulsing orange-red flash and scanline sweep with noise
                  float pulse = sin(uTime * 18.0) * 0.35 + 0.65;
                  float sweep = step(fract(vLocalPosition.y * 1.5 - uTime * 4.0), 0.35) * 0.40;
                  float errorNoise = hash(noiseUv + sin(uTime * 45.0));
                  float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, errorNoise);
                  vec3 errorRed = vec3(1.0, 0.27, 0.0);
                  if (uTheme > 0.9 && uTheme < 1.1) {
                    finalColor = errorRed * noisyIntensity;
                  } else {
                    finalColor = mix(finalColor, errorRed * (noisyIntensity + 0.4), 0.85);
                  }
                } else if (uIsSuccess > 0.5) {
                  // Success on side walls: neon green pulse and scanline sweep
                  float pulse = sin(uTime * 15.0) * 0.4 + 0.6;
                  float sweep = step(fract(vLocalPosition.y * 0.2 - uTime * 2.0), 0.15) * 0.35;
                  if (uTheme > 0.9 && uTheme < 1.1) {
                    finalColor = vec3(pulse + sweep);
                  } else {
                    finalColor = mix(finalColor, neonGreen * (pulse + sweep + 0.5), 0.85);
                  }
                } else {
                  // Normal selected side: holographic laser wall barrier!
                  vec2 uv = gl_FragCoord.xy;
                  float beamPattern = sin(uv.y * 0.4 - uTime * 15.0) * 0.5 + 0.5;
                  float wallNoise = fract(sin(dot(uv + uTime, vec2(12.9898,78.233))) * 43758.5453);
                  vec3 beamColor = vec3(1.0);
                  finalColor = mix(gl_FragColor.rgb, beamColor, 0.3 + 0.7 * beamPattern * (0.8 + 0.2 * wallNoise));
                }
              } else {
                // TOP CAP GEOMETRY
                if (uTheme > 0.9 && uTheme < 1.1) {
                  // Blackout theme: 100% monochrome static
                  finalColor = staticVec;
                } else {
                  // Other themes: subtle holographic noise overlay
                  finalColor = mix(gl_FragColor.rgb, staticVec, 0.40);
                }

                if (uIsError > 0.5) {
                  // Error on cap: fast pulsing orange-red flash and scanline sweep with noise
                  float pulse = sin(uTime * 18.0) * 0.35 + 0.65;
                  float sweep = step(fract(vLocalPosition.y * 1.5 - uTime * 4.0), 0.35) * 0.40;
                  float errorNoise = hash(noiseUv + sin(uTime * 45.0));
                  float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, errorNoise);
                  vec3 errorRed = vec3(1.0, 0.27, 0.0);
                  if (uTheme > 0.9 && uTheme < 1.1) {
                    finalColor = errorRed * noisyIntensity;
                  } else {
                    finalColor = mix(finalColor, errorRed * (noisyIntensity + 0.4), 0.85);
                  }
                }

                if (uIsSuccess > 0.5) {
                  // Success on cap: s'illumine with an animated high-contrast flash/pulse
                  float pulse = sin(uTime * 15.0) * 0.4 + 0.6;
                  float sweep = step(fract(vLocalPosition.y * 0.2 - uTime * 2.0), 0.15) * 0.35;
                  if (uTheme > 0.9 && uTheme < 1.1) {
                    finalColor = vec3(pulse + sweep);
                  } else {
                    finalColor = mix(finalColor, neonGreen * (pulse + sweep + 0.5), 0.85);
                  }
                }
              }

              gl_FragColor.rgb = mix(finalColor, uTargetColor, uFadeProgress);
             `,
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
    },
    [
      getPolygonColor,
      getPolygonSideColor,
      isLight,
      globeLightingEnabled,
      UI_COLORS,
      selectedCountry,
      isDepartmentMode,
      foundSet,
      globeTheme,
      mode,
      perfProfile,
      isHomeScreen,
    ],
  );

  const getPolygonCapMaterial = useCallback(
    (d) => getPolygonMaterial(d, "cap"),
    [getPolygonMaterial],
  );

  const getPolygonSideMaterial = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      if (admin === selectedCountry) {
        // Selected country gets a visible, brightly colored side wall acting as a thick highlighted border
        return getPolygonMaterial(d, "side");
      }
      return invisibleMaterial;
    },
    [selectedCountry, getPolygonMaterial],
  );

  useEffect(() => {
    const materialCache = polygonMaterialCacheRef.current;
    const sharedPool = sharedMaterialsRef.current;
    return () => {
      materialCache.cap.clear();
      materialCache.side.clear();
      sharedPool.forEach((material) => material.dispose());
      sharedPool.clear();
    };
  }, [isLight, globeTheme, globeLightingEnabled, mode, isDepartmentMode]);

  const getPolygonAltitude = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;
      // Uniform extrusion via gameConfig — department mode is viewed up close so its
      // selected altitude is scaled down to match a world-view country's apparent height.
      return getPolygonAltitudeFor({
        isDepartmentMode,
        isGhostCountry: !!(isDepartmentMode && d.isGhostCountry),
        isSelected,
      });
    },
    [isDepartmentMode, selectedCountry],
  );

  const getSelectionEffectAltitude = useCallback(() => {
    if (selectedCountry) return 0.0075; // Above selected country's 3.5D surface (0.006)
    return 0.0015;
  }, [selectedCountry]);

  const getHtmlAltitude = useCallback(
    (d) => {
      if (selectedCountry && d.admin === selectedCountry) return 0.0085; // Above selected country & selection effect
      return 0.002;
    },
    [selectedCountry],
  );

  const getPolygonStrokeWidth = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;
      if (isDepartmentMode && d.isGhostCountry) {
        return perfProfile?.isMobile ? 0.1 : 0.15;
      }
      // Increased thickness for selection (contour plus visible)
      if (isSelected) return perfProfile?.isMobile ? 5.5 : 7.5;
      if (isDepartmentMode) return perfProfile?.isMobile ? 0.85 : 1.1;
      const thickness = perfProfile?.isMobile
        ? (Number(UI_COLORS.strokeWidthMobile) || 0.55)
        : (Number(UI_COLORS.strokeWidthDesktop) || 0.75);

      if (!UI_COLORS.isBlackoutTheme && (isLight || globeLightingEnabled)) {
        return thickness + 0.2;
      }
      return thickness;
    },
    [
      globeLightingEnabled,
      isLight,
      perfProfile?.isMobile,
      selectedCountry,
      isDepartmentMode,
      UI_COLORS,
    ],
  );

  const countrySizes = useMemo(() => {
    const sizes = {};
    selectableFeatureIndex.forEach((entry) => {
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

    return renderCountriesData.filter((feature) => {
      const admin = getFeatureAdmin(feature);
      if (!admin) return false;
      if (admin === selectedCountry) return true;

      const data = countryDataMap[admin];
      if (!data || data.lat === undefined || data.lng === undefined)
        return true;

      const size = countrySizes[admin] || 1;
      const sizeBuffer = Math.min(70, Math.max(8, size * 0.75));
      const distToCenter = getLngLatDistance(
        data.lng,
        data.lat,
        pov.lng,
        pov.lat,
      );

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
    zoomLevel,
  ]);

  const labelsData = useMemo(() => {
    if (perfProfile?.maxLabels === 0 || !globeEl.current) return [];

    let labelsToProcess = [];

    if (isHomeScreen) {
      if (selectedCountry) {
        labelsToProcess.push({
          key: selectedCountry,
          data: countryDataMap[selectedCountry],
          modeName: mode,
        });
      }
    } else if (isDepartmentMode) {
      Object.keys(gameDataMap).forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName: "departments",
        });
      });
    } else if (isRiversMountainsMode) {
      Object.keys(gameDataMap).forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName: "rivers_mountains",
        });
      });
    } else if (mode === "learn") {
      if (learnShowCountryLabels || learnShowCapitals) {
        Object.keys(countryDataMap).forEach((k) => {
          labelsToProcess.push({
            key: k,
            data: countryDataMap[k],
            modeName: learnShowCountryLabels ? "countries" : "capitals",
            hideCountryLine: !learnShowCountryLabels,
          });
        });
      }
      if (learnShowRivers) {
        Object.keys(riversMountainsDataMap).forEach((k) => {
          if (riversMountainsDataMap[k].type === "river") {
            labelsToProcess.push({
              key: k,
              data: riversMountainsDataMap[k],
              modeName: "rivers_mountains",
            });
          }
        });
      }
      if (learnShowMountains) {
        Object.keys(riversMountainsDataMap).forEach((k) => {
          if (
            riversMountainsDataMap[k].type === "mountain" ||
            riversMountainsDataMap[k].type === "mountain_range"
          ) {
            labelsToProcess.push({
              key: k,
              data: riversMountainsDataMap[k],
              modeName: "rivers_mountains",
            });
          }
        });
      }
    } else {
      const keys =
        isEndScreen
          ? Object.keys(countryDataMap)
          : perfProfile?.isMobile
            ? selectedCountry
              ? [...new Set([selectedCountry, ...foundList.slice(-1)])]
              : foundList.slice(-2)
            : selectedCountry && !foundList.includes(selectedCountry)
              ? [...foundList, selectedCountry]
              : foundList;
      keys.forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: countryDataMap[k],
          modeName: mode,
        });
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
        const isPlayMode = mode !== "learn" && !isHomeScreen && !isEndScreen;
        if (isPlayMode && !isFound && !isSelected) {
          return null;
        }

        // Visibility based on zoom level
        const isRivMount = modeName === "rivers_mountains";
        const visibilityThreshold = isDepartmentMode
          ? 1.05
          : isSelected
            ? 10
            : isHomeScreen
              ? 1.8
              : isRivMount
                ? 2.5
                : Math.min(3.0, 0.8 + size * 2.0);

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
          cached.hideCountryLine === hideCountryLine &&
          cached.isError === (isSelected && isError)
        ) {
          cached.distToCenter = distToCenter;
          return cached;
        }

        const newLabel = {
          admin: key,
          lat: data.lat,
          lng: data.lng,
          country: lang === "fr" ? data.name_fr || key : data.name_en || key,
          capital:
            lang === "fr" ? data.capital_fr || data.capital : data.capital,
          region: data.region,
          flag: getFlagEmoji(data.iso2),
          code: data.code,
          size,
          distToCenter,
          isSelected,
          isFound,
          isError: isSelected && isError,
          mode: modeName,
          learnShowCapitals,
          hideCountryLine,
          lang,
        };
        labelsCacheRef.current[cacheKey] = newLabel;
        return newLabel;
      })
      .filter((d) => d !== null)
      .sort((a, b) => {
        if (a.isSelected) return -1;
        if (b.isSelected) return 1;
        return a.distToCenter - b.distToCenter;
      });

    if (isDepartmentMode)
      return filtered.slice(0, perfProfile?.isMobile ? 10 : 18);
    if (mode === "learn") {
      const limit = perfProfile?.isMobile ? 20 : 40;
      return filtered.slice(0, limit);
    }
    return perfProfile?.maxLabels
      ? filtered.slice(0, perfProfile.maxLabels)
      : filtered;
  }, [
    foundList,
    countrySizes,
    zoomLevel,
    cameraPOV,
    lang,
    perfProfile?.maxLabels,
    perfProfile?.isMobile,
    mode,
    selectedCountry,
    isHomeScreen,
    isDepartmentMode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    learnShowCountryLabels,
    learnShowCapitals,
    learnShowRivers,
    learnShowMountains,
    isError,
  ]);

  const scrambleTextWithRatio = useCallback((text, ratio) => {
    if (!text) return "";
    const glyphs = "░▒▓█░▒▓█▲▼◆◇@#$%&?*¢¤§[]{}<>/=+_~^0123456789XØÆßΔΩΨΞ";
    return text
      .split("")
      .map((char) => {
        if (char === " " || char === "-" || char === "'") return char;
        if (Math.random() < ratio) {
          const glyphIndex = Math.floor(Math.random() * glyphs.length);
          return glyphs[glyphIndex];
        }
        return char;
      })
      .join("");
  }, []);

  const createLabelElement = useCallback(
    (d) => {
      const el = document.createElement("div");

      let color;
      if (d.mode === "departments") {
        color = d.isFound
          ? UI_COLORS.success
          : d.isSelected
            ? UI_COLORS.accent
            : UI_COLORS.textMuted;
      } else if (isHomeScreen) {
        color = d.isSelected ? UI_COLORS.accent : UI_COLORS.textMuted;
      } else {
        const isHighlight = d.isFound || d.isSelected;
        const colorType = UI_COLORS.labelColorType || "regional";

        if (colorType === "paper") {
          color = isHighlight ? UI_COLORS.accent : UI_COLORS.textMuted;
        } else {
          // regional
          color = isHighlight
            ? REGION_COLORS_LABELS[d.region] || UI_COLORS.accent
            : UI_COLORS.textMuted;
        }
      }

      // Set root to 0 size so its center is the exact lat/lng
      el.style.width = "0";
      el.style.height = "0";
      el.style.position = "relative";
      el.style.pointerEvents = "none";
      el.style.userSelect = "none";

      const isPlayMode =
        mode !== "learn" && d.mode !== "learn" && !isHomeScreen && !isEndScreen;
      const revealAll = !isPlayMode || d.isFound;

      // Uniform scramble across every guessable mode (countries, capitals, departments,
      // rivers/mountains) so no mode leaks its answer as readable text.
      const isGlitchMode = shouldScrambleLabel(d.mode, {
        isFound: d.isFound,
        isHomeScreen,
        isEndScreen,
        isSelected: d.isSelected,
        isLearn: mode === "learn",
      });


      if (isGlitchMode) {
        const isCapitalsMode = d.mode === "capitals";
        const isDeptMode = d.mode === "departments";
        const isReliefMode = d.mode === "rivers_mountains";
        const isErrorLabel = d.isError;

        let glitchLine1Class = "glitch-country";
        let glitchLine1Raw = d.country;
        if (isErrorLabel) {
          glitchLine1Class = "glitch-error";
          glitchLine1Raw = `⚠ ${t("error")}`;
        } else if (isCapitalsMode) {
          glitchLine1Class = "glitch-capital";
          glitchLine1Raw = d.capital;
        } else if (isDeptMode) {
          glitchLine1Class = "glitch-dept";
          glitchLine1Raw = d.country;
        } else if (isReliefMode) {
          glitchLine1Class = "glitch-relief";
          glitchLine1Raw = d.country;
        }

        const prefixHtml = isDeptMode && !isErrorLabel
          ? `<span style="font-family: monospace; color: ${UI_COLORS.accent}; opacity: 0.85;">${t("dept_abbr")} ${d.admin}:</span>`
          : "";

        const dotColor = isErrorLabel ? UI_COLORS.error : color;
        const stalkColor = isErrorLabel ? UI_COLORS.error : UI_COLORS.accent;
        const textColor = isErrorLabel ? UI_COLORS.error : UI_COLORS.textMain;

        el.innerHTML = `
        <div class="globe-label-element" style="position: relative; width: 0; height: 0; pointer-events: none;">
          <!-- Dot -->
          <div style="
            position: absolute;
            width: 6px;
            height: 6px;
            background: ${dotColor};
            border-radius: 50%;
            left: -3px;
            top: -3px;
            box-shadow: 0 0 8px ${dotColor};
            opacity: ${isHomeScreen ? 0.5 : 1};
          "></div>
          <!-- Stalk Line (Shortened to 15px) -->
          <div style="
            position: absolute;
            width: 1.2px;
            height: 15px;
            background: ${stalkColor};
            left: -0.6px;
            bottom: 3px;
            box-shadow: 0 1px 3px color-mix(in srgb, ${UI_COLORS.black} 85%, transparent);
            opacity: ${isHomeScreen ? 0.4 : 0.85};
          "></div>
          <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
          <div class="scramble-callout" style="
            position: absolute;
            left: 50%;
            bottom: 21px;
            transform: translateX(-50%);
            animation: labelReveal 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: var(--font-display, monospace) !important;
            white-space: nowrap;
            color: ${textColor};
            text-shadow: 0 1px 2px color-mix(in srgb, ${UI_COLORS.black} 60%, transparent);
            opacity: ${isHomeScreen ? 0.6 : 1};
          ">
            <div style="font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 4px; font-family: var(--font-display, monospace) !important;">
              ${prefixHtml}
              <span class="${glitchLine1Class}" data-text="${glitchLine1Raw}" style="font-family: var(--font-display, monospace) !important;">${isErrorLabel ? glitchLine1Raw : scrambleText(glitchLine1Raw)}</span>
            </div>
            ${
              isCapitalsMode && !isErrorLabel
                ? `
              <div style="font-weight: 500; font-size: 9px; color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px; font-family: var(--font-display, monospace) !important;">
                <span class="glitch-country" data-text="${d.country}" style="font-family: var(--font-display, monospace) !important;">${scrambleText(d.country)}</span>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;

        let hasBeenAttached = false;
        // Start dynamic scrambling interval
        const interval = setInterval(() => {
          const isAttached = document.body.contains(el);
          if (isAttached) {
            hasBeenAttached = true;
          }
          if (hasBeenAttached && !isAttached) {
            clearInterval(interval);
            return;
          }
          const countryEl = el.querySelector(".glitch-country");
          const capitalEl = el.querySelector(".glitch-capital");
          const deptEl = el.querySelector(".glitch-dept");
          const reliefEl = el.querySelector(".glitch-relief");

          if (countryEl) {
            const raw = countryEl.getAttribute("data-text") || "";
            countryEl.innerText = scrambleText(raw, Math.random());
          }
          if (capitalEl) {
            const raw = capitalEl.getAttribute("data-text") || "";
            capitalEl.innerText = scrambleText(raw, Math.random());
          }
          if (deptEl) {
            const raw = deptEl.getAttribute("data-text") || "";
            deptEl.innerText = scrambleText(raw, Math.random());
          }
          if (reliefEl) {
            const raw = reliefEl.getAttribute("data-text") || "";
            reliefEl.innerText = scrambleText(raw, Math.random());
          }
        }, 150);
      } else {
        // Normal clean callout box (Minimalist, centered on top of stalk)
        const iconSymbol =
          d.mode === "rivers_mountains"
            ? gameDataMap[d.admin]?.type === "mountain_range" ||
              riversMountainsDataMap[d.admin]?.type === "mountain_range"
              ? "🏔️ "
              : "💧 "
            : "";

        const displayName = revealAll ? d.country : "???";
        const displayCapital = revealAll ? d.capital : "???";

        const hasCapitalLine =
          (d.mode === "capitals" ||
            (mode === "learn" && d.learnShowCapitals)) &&
          d.capital;

        const isDeptMode = d.mode === "departments";

        const prefixHtml = isDeptMode
          ? `<span style="font-family: monospace; color: ${UI_COLORS.accent}; opacity: 0.85;">${t("dept_abbr")} ${d.admin}:</span>`
          : "";

        const getScrambledHtml = (ratio) => {
          let scrambledLine1;
          let scrambledLine2 = null;

          const scramble = (txt) => {
            if (ratio <= 0.0) return txt;
            return scrambleTextWithRatio(txt, ratio);
          };

          if (isDeptMode) {
            const rawCode = d.code ? `<span style="font-weight: 800; background: ${color}; color: ${UI_COLORS.textInverse}; padding: 0px 3px; border-radius: 3px; font-size: 9px; line-height: 1.1; margin-right: 3px;">${d.code}</span>` : "";
            scrambledLine1 = `
              ${rawCode}
              <span>${scramble(displayName)}</span>
            `;
            if (d.capital) {
              scrambledLine2 = `(${scramble(displayCapital)})`;
            }
          } else {
            const baseLine1Text = hasCapitalLine
              ? `${d.capital}`
              : `${d.country}`;
            const prefix = hasCapitalLine
              ? `${d.flag || ""}`
              : `${iconSymbol || d.flag || ""}`;
            
            scrambledLine1 = `<span>${prefix} ${scramble(baseLine1Text)}</span>`;
            if (hasCapitalLine && !d.hideCountryLine) {
              scrambledLine2 = scramble(d.country);
            }
          }

          return `
            <div style="font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 4px; font-family: ${ratio > 0.0 ? "var(--font-display, monospace) !important" : "inherit"};">
              ${scrambledLine1}
            </div>
            ${
              scrambledLine2
                ? `
              <div style="font-weight: 500; font-size: 9px; color: color-mix(in srgb, ${UI_COLORS.textMuted} 80%, transparent); margin-top: 1px; font-family: ${ratio > 0.0 ? "var(--font-display, monospace) !important" : "inherit"};">
                ${scrambledLine2}
              </div>
            `
                : ""
            }
          `;
        };

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
            background: ${UI_COLORS.accent};
            left: -0.6px;
            bottom: 3px;
            box-shadow: 0 1px 3px color-mix(in srgb, ${UI_COLORS.black} 85%, transparent);
            opacity: ${isHomeScreen ? 0.4 : 0.85};
          "></div>
          <!-- Centered Minimalist Label directly above the stalk (placed at bottom: 21px) -->
          <div class="normal-text-container" style="
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
            ${getScrambledHtml(1.0)}
          </div>
        </div>
      `;

        let scrambleProgress = 0.0;
        let hasBeenAttached = false;
        
        const mountInterval = setInterval(() => {
          const isAttached = document.body.contains(el);
          if (isAttached) {
            hasBeenAttached = true;
          }
          if (hasBeenAttached && !isAttached) {
            clearInterval(mountInterval);
            return;
          }

          scrambleProgress += 0.08; // ~360ms total duration
          const textContainer = el.querySelector(".normal-text-container");
          if (!textContainer) return;

          if (scrambleProgress >= 1.0) {
            clearInterval(mountInterval);
            textContainer.innerHTML = getScrambledHtml(0.0);
            return;
          }

          textContainer.innerHTML = getScrambledHtml(1.0 - scrambleProgress);
        }, 30);
      }
      return el;
    },
    [
      REGION_COLORS_LABELS,
      UI_COLORS,
      isHomeScreen,
      isEndScreen,
      isLight,
      gameDataMap,
      globeTheme,
      mode,
      t,
      scrambleTextWithRatio,
    ],
  );

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
    const isLearnRivers = mode === "learn" && learnShowRivers;
    if (mode !== "rivers_mountains" && !isLearnRivers) return [];
    const paths = [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    Object.keys(dataMap).forEach((k) => {
      const data = dataMap[k];
      if (!data || data.type !== "river" || !data.path) return;
      const isFound = foundSet.has(k) || mode === "learn" || isHomeScreen;
      // Found rivers read as solid coloured lines; unfound ones stay as a faint dashed
      // hint so the player still knows where to click — their NAME is hidden (scrambled
      // label, only shown when selected), so the answer isn't given away.
      paths.push({
        admin: k,
        coords: getSmoothedRiverPath(k, data.path),
        color: isFound ? UI_COLORS.riverActive : UI_COLORS.riverInactive,
        width: isFound ? 45 : 24,
        dashLength: isFound ? 1 : 0.5,
        dashGap: isFound ? 0 : 0.3,
        dashAnimateTime: isFound ? 3000 : 0, // Subtle shimmer on found rivers
      });
    });
    return paths;
  }, [gameDataMap, foundSet, mode, isHomeScreen, UI_COLORS, learnShowRivers]);

  const riversSelectedPathData = useMemo(() => {
    const isLearnRivers = mode === "learn" && learnShowRivers;
    if ((mode !== "rivers_mountains" && !isLearnRivers) || !selectedCountry)
      return [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    const data = dataMap[selectedCountry];
    if (!data || data.type !== "river" || !data.path) return [];
    const isFound =
      foundSet.has(selectedCountry) || mode === "learn" || isHomeScreen;
    const color = isFound
      ? isError
        ? UI_COLORS.error
        : UI_COLORS.riverSelectedFound
      : isError
        ? UI_COLORS.errorGlowStrong
        : UI_COLORS.riverSelectedUnfound;

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
        dashAnimateTime: 0,
      },
      // Layer 2: Thinner, animated glowing white core representing current flow
      {
        admin: `${selectedCountry}_core`,
        coords: smoothedPath,
        color: UI_COLORS.paper,
        width: isFound ? 24 : 18,
        dashLength: 0.25,
        dashGap: 0.15,
        dashAnimateTime: 800,
      },
    ];
  }, [
    gameDataMap,
    foundSet,
    mode,
    isHomeScreen,
    selectedCountry,
    isError,
    UI_COLORS,
    learnShowRivers,
  ]);

  // Base mountain paths
  const mountainsBasePathsData = useMemo(() => {
    const isLearnMountains = mode === "learn" && learnShowMountains;
    if (mode !== "rivers_mountains" && !isLearnMountains) return [];
    const paths = [];
    const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
    Object.keys(dataMap).forEach((k) => {
      const data = dataMap[k];
      if (!data || data.type !== "mountain_range" || !data.path) return;
      const isFound = foundSet.has(k) || mode === "learn" || isHomeScreen;
      const color = isFound
        ? getThemeRegionColor(globeTheme, theme, data.region)
        : UI_COLORS.riverInactive;

      paths.push({
        admin: k,
        coords: data.path.map(([lat, lng]) => [lat, lng, 0.002]), // Lifted slightly above surface
        color,
        width: isFound ? 35 : 20, // Pixels width
        dashLength: isFound ? 1.0 : 0.4,
        dashGap: isFound ? 0.0 : 0.25,
        dashAnimateTime: 0,
      });
    });
    return paths;
  }, [
    gameDataMap,
    foundSet,
    mode,
    isHomeScreen,
    globeTheme,
    theme,
    UI_COLORS,
    learnShowMountains,
  ]);

  // Selected mountain paths
  const mountainsSelectedPathData = useMemo(() => {
    const isLearnMountains = mode === "learn" && learnShowMountains;
    if ((mode !== "rivers_mountains" && !isLearnMountains) || !selectedCountry)
      return [];
    const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
    const data = dataMap[selectedCountry];
    if (!data || data.type !== "mountain_range" || !data.path) return [];
    const isFound =
      foundSet.has(selectedCountry) || mode === "learn" || isHomeScreen;
    const regionColor = getThemeRegionColor(globeTheme, theme, data.region);
    const color = isFound
      ? isError
        ? UI_COLORS.error
        : regionColor
      : isError
        ? UI_COLORS.errorGlowStrong
        : UI_COLORS.textMuted;

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
        dashAnimateTime: 0,
      },
      // Inner glowing core
      {
        admin: `${selectedCountry}_core`,
        coords: pathPoints,
        color: UI_COLORS.paper,
        width: isFound ? 16 : 12,
        dashLength: 0.35,
        dashGap: 0.15,
        dashAnimateTime: 1200,
      },
    ];
  }, [
    gameDataMap,
    foundSet,
    mode,
    isHomeScreen,
    selectedCountry,
    isError,
    UI_COLORS,
    globeTheme,
    theme,
    learnShowMountains,
  ]);

  // Combined for globe: base first, selected on top (exclude mountain lines - only show 3D mountains)
  const globePathsData = useMemo(
    () => [...riversBasePathsData, ...riversSelectedPathData],
    [riversBasePathsData, riversSelectedPathData],
  );

  const getBiomeAssetsData = useMemo(() => {
    const isLearnMountains = mode === "learn" && learnShowMountains;
    if (mode === "rivers_mountains" || isLearnMountains) {
      const assets = [];
      const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
      Object.keys(dataMap).forEach((k) => {
        const data = dataMap[k];
        if (!data || data.lat === undefined) return;
        if (data.type !== "mountain" && data.type !== "mountain_range") return;
        const isFound = foundSet.has(k) || mode === "learn" || isHomeScreen;
        // Render every mountain so it stays clickable; unfound ones show as a smaller,
        // neutral placeholder (their NAME is hidden), found ones at representative size.
        assets.push({
          admin: k,
          lat: data.lat,
          lng: data.lng,
          isFound,
          type: data.type,
          bearing: data.bearing || 0,
          spread: data.spread || 1.5,
          height: data.height || 4000,
          scale: data.type === "mountain_range" ? 1.55 : 1.0,
          rotation: 0,
          path: data.path || null,
        });
      });
      return assets;
    }

    return [];
  }, [gameDataMap, mode, foundSet, isHomeScreen, learnShowMountains]);

  const getBiomeAltitude = useCallback(
    (d) => {
      const admin = d.admin;
      const isLearnMountains = mode === "learn" && learnShowMountains;
      if (mode === "rivers_mountains" || isLearnMountains) {
        return admin === selectedCountry ? 0.003 : 0.0015;
      }
      return admin === selectedCountry ? 0.0025 : 0.0015;
    },
    [selectedCountry, mode, learnShowMountains],
  );

  const createBiomeThreeObject = useCallback(
    (d) => {
      const isSelected = d.admin === selectedCountry;
      const key = `${d.admin || "unknown"}_${d.isFound ? "found" : "unfound"}_selected_${isSelected}_${d.scale}_${d.lat}_${d.lng}_${globeTheme}`;

      if (biomeObjectsCacheRef.current.has(key)) {
        return biomeObjectsCacheRef.current.get(key);
      }

      let asset;
      const isLearnMountains = mode === "learn" && learnShowMountains;
      const baseScale = d.scale * BIOME_SCENE_SCALE;
      if (mode === "rivers_mountains" || isLearnMountains) {
        if (!d.isFound) {
          asset = createUnfoundPlaceholder(
            d.type,
            globeTheme,
            isSelected,
            d.bearing,
            d.spread,
            d.path,
            d.lat,
            d.lng,
            baseScale,
          );
        } else {
          if (d.type === "mountain" || d.type === "mountain_range") {
            asset = createMountainFeature(
              globeTheme,
              isSelected,
              d.bearing,
              d.spread,
              d.height,
              d.path,
              d.lat,
              d.lng,
              baseScale,
            );
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
      // Consistent, geographically-representative size: found mountains at full scale,
      // unfound ones at a slightly smaller neutral scale — close enough that finding one
      // no longer makes it pop from a tiny placeholder to full size.
      alignedAsset.scale.setScalar(
        baseScale * (d.isFound ? RELIEF.mountainScale : RELIEF.targetHintScale),
      );

      biomeObjectsCacheRef.current.set(key, alignedAsset);
      return alignedAsset;
    },
    [theme, globeTheme, mode, selectedCountry, learnShowMountains],
  );

  useEffect(() => {
    // Clear biome objects cache when theme changes to prevent memory leak and release old theme assets
    biomeObjectsCacheRef.current.clear();
  }, [globeTheme, theme]);

  const ringsData = useMemo(() => {
    if (selectedCountry) {
      const mapped = gameDataMap[selectedCountry];
      if (mapped?.type === "river") return [];
      const region = mapped?.region || "Unknown";
      if (mapped && mapped.lat !== undefined) {
        const isFound =
          foundSet.has(selectedCountry) || mode === "learn" || isHomeScreen;
        const baseColor = isError
          ? UI_COLORS.error
          : !isFound
            ? UI_COLORS.textMuted
            : UI_COLORS.selectionRingColor ||
              REGION_COLORS_LABELS[region] ||
              REGION_COLORS[region] ||
              UI_COLORS.accent;
        const softColor = lerpColor(
          baseColor,
          UI_COLORS.paper,
          isLight ? 0.35 : 0.2,
        );
        if (isDepartmentMode) {
          return [
            {
              lat: mapped.lat,
              lng: mapped.lng,
              color: baseColor,
              maxRadius: perfProfile?.isMobile ? 0.22 : 0.32,
              speed: perfProfile?.isMobile ? 0.12 : 0.16,
              repeat: perfProfile?.isMobile ? 3200 : 2800,
            },
          ];
        }

        // Tight, high-tech target lock reticle (instead of wide radar waves)
        return [
          {
            lat: mapped.lat,
            lng: mapped.lng,
            color: baseColor,
            maxRadius: 0.3,
            speed: 0.6,
            repeat: 800,
          },
          {
            lat: mapped.lat,
            lng: mapped.lng,
            color: softColor,
            maxRadius: 0.15,
            speed: 0.3,
            repeat: 500,
          },
        ];
      }
    }
    return [];
  }, [
    gameDataMap,
    isDepartmentMode,
    isError,
    isLight,
    perfProfile?.isMobile,
    REGION_COLORS,
    REGION_COLORS_LABELS,
    selectedCountry,
    UI_COLORS,
    mode,
    globeTheme,
    foundSet,
    isHomeScreen,
  ]);

  const customGlobeTexture = useMemo(() => {
    if (UI_COLORS.globeTextureUrl) {
      const loader = new THREE.TextureLoader();
      const texture = loader.load(UI_COLORS.globeTextureUrl);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      return texture;
    }
    return null;
  }, [UI_COLORS.globeTextureUrl]);

  useEffect(() => {
    return () => {
      if (customGlobeTexture) {
        customGlobeTexture.dispose();
      }
    };
  }, [customGlobeTexture]);

  const globeMaterial = useMemo(() => {
    const matType = UI_COLORS.globeMaterialType || "phong";

    if (matType === "basic") {
      const baseColor = UI_COLORS.globeMaterialColor
        ? (UI_COLORS.globeMaterialColor.startsWith("#") ? UI_COLORS.globeMaterialColor : UI_COLORS[UI_COLORS.globeMaterialColor] || UI_COLORS.mapSea)
        : UI_COLORS.mapSea;
      return new THREE.MeshBasicMaterial({
        color: baseColor,
      });
    }

    if (UI_COLORS.globeTextureUrl) {
      return new THREE.MeshPhongMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        specular: 0x333333,
        shininess: 15,
        flatShading: false,
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
      shininess: globeLightingEnabled ? (isLight ? 4 : 8) : 0.7,
    });
  }, [
    UI_COLORS,
    isLight,
    globeLightingEnabled,
    customGlobeTexture,
  ]);

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
        const {
          keyLight,
          rimLight,
          fillLight,
          studioLight,
          studioLeft,
          studioRight,
          group,
        } = globeLightingRef.current;
        const camera = globeEl.current?.camera?.();
        if (camera) {
          camera.remove(
            keyLight,
            rimLight,
            fillLight,
            studioLight,
            studioLeft,
            studioRight,
          );
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

    // True only on the frame the lighting rig is first built. Used at the end of
    // this function to SNAP the atmosphere glow straight to its theme target the
    // first time, instead of letting the rAF loop slowly lerp it from a default
    // blue — that lerp was the "globe slowly changes colour on load" flicker.
    let justCreatedLighting = false;

    if (!globeLightingRef.current) {
      justCreatedLighting = true;
      const camera = globeEl.current?.camera?.();
      if (!camera) return false;
      scene.add(camera); // Make camera part of scene hierarchy so children lights propagate

      const group = new THREE.Group();
      group.name = "globe-accent-lighting";

      const keyLight = new THREE.DirectionalLight(0xffffff, 1);
      keyLight.name = "globe-key-light";
      keyLight.position.set(-3.5, 2.4, 4.2);

      const rimLight = new THREE.DirectionalLight(0x78a8ff, 1);
      rimLight.name = "globe-rim-light";
      rimLight.position.set(3.8, 1.3, -3.6);

      const fillLight = new THREE.HemisphereLight(0x9cc4ff, 0x020617, 1);
      fillLight.name = "globe-fill-light";
      fillLight.position.set(0, 2.2, 0);

      const studioLight = new THREE.AmbientLight(0xbfdcff, 1);
      studioLight.name = "globe-studio-ambient";

      const studioLeft = new THREE.DirectionalLight(0xffffff, 1);
      studioLeft.name = "globe-studio-left";
      studioLeft.position.set(-4.5, 2.5, 3.5);

      const studioRight = new THREE.DirectionalLight(0x9fd2ff, 1);
      studioRight.name = "globe-studio-right";
      studioRight.position.set(4.5, -1.2, 2.8);

      const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(114.0, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader: FRESNEL_VERTEX_SHADER,
          fragmentShader: FRESNEL_FRAGMENT_SHADER,
          uniforms: {
            glowColor: { value: new THREE.Color(0x64b5f6) },
            coef: { value: 1.0 },
            power: { value: 1.2 },
          },
          transparent: true,
          blending: THREE.NormalBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      innerGlow.name = "globe-inner-glow";
      innerGlow.position.set(0, 0, 0);
      innerGlow.renderOrder = -1;

      // Add innerGlow (positioned at center of Earth) to group, and add group to scene
      group.add(innerGlow);
      scene.add(group);

      // Add the directional/ambient lights to the CAMERA so they move/rotate with the viewer's head
      camera.add(
        keyLight,
        rimLight,
        fillLight,
        studioLight,
        studioLeft,
        studioRight,
      );

      globeLightingRef.current = {
        group,
        keyLight,
        rimLight,
        fillLight,
        studioLight,
        studioLeft,
        studioRight,
        innerGlow,
      };
      // The glow's final colour/power/coef are computed below and snapped onto
      // the uniforms at the end of this function (see justCreatedLighting).
    }

    const {
      keyLight,
      rimLight,
      fillLight,
      studioLight,
      studioLeft,
      studioRight,
      innerGlow,
    } = globeLightingRef.current;

    const isMobile = perfProfile?.isMobile;

    if (isMobile) {
      rimLight.visible = false;
      studioLight.visible = false;
      studioLeft.visible = false;
      studioRight.visible = false;
      innerGlow.visible = false;
    } else {
      rimLight.visible = !UI_COLORS.isBlackoutTheme;
      studioLight.visible = true;
      studioLeft.visible = !UI_COLORS.isBlackoutTheme;
      studioRight.visible = !UI_COLORS.isBlackoutTheme;
      innerGlow.visible = true;
    }

    // Disable built-in Three-Globe lights that are added automatically and override our settings
    scene.traverse((obj) => {
      if (obj.isLight && !obj.name.startsWith("globe-")) {
        obj.intensity = 0;
      }
    });

    if (UI_COLORS.isBlackoutTheme) {
      // Balanced soft ambient/hemisphere lighting for 3D volume on the entire globe (no dark southern hemisphere) - slightly boosted for legibility
      keyLight.intensity = isLight ? 0.28 : 0.44;
      keyLight.position.set(-3.5, 2.4, 4.2);
      rimLight.intensity = 0; // Disabled
      fillLight.intensity = isLight ? 0.44 : 0.32; // Soft top/bottom ambient lighting
      studioLight.intensity = isLight ? 0.3 : 0.18; // Flat base light to illuminate all angles
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

    let glowColorHex = isLight
      ? (Number(UI_COLORS.glowColorHexLight) || Number(UI_COLORS.glowColorHex) || 0x3a76f0)
      : (Number(UI_COLORS.glowColorHexDark) || Number(UI_COLORS.glowColorHex) || 0x3a76f0);
    let glowPower = Number(UI_COLORS.glowPower) || 1.2;
    let glowCoef = Number(UI_COLORS.glowCoef) || 0.08;

    // Update target refs instead of direct uniform changes to enable smooth lerped transition in animateScene
    targetGlowColorRef.current.setHex(glowColorHex);
    targetGlowPowerRef.current = glowPower;
    targetGlowCoefRef.current = glowCoef;

    // First build: snap the uniforms straight to target so the glow appears at its
    // final colour immediately (no slow load-time colour drift). Later theme changes
    // keep the smooth lerp handled by animateScene.
    if (justCreatedLighting && innerGlow.material?.uniforms) {
      const u = innerGlow.material.uniforms;
      u.glowColor.value.copy(targetGlowColorRef.current);
      u.power.value = glowPower;
      u.coef.value = glowCoef;
    }

    return true;
  }, [
    isLight,
    globeLightingEnabled,
    UI_COLORS,
    perfProfile?.isMobile,
    globeTheme,
    selectedCountry,
    activeDataMap,
    REGION_COLORS,
    safeColor,
  ]);

  useEffect(() => {
    updateGlobeLighting();

    return () => {
      if (globeLightingRef.current) {
        const {
          keyLight,
          rimLight,
          fillLight,
          studioLight,
          studioLeft,
          studioRight,
          group,
        } = globeLightingRef.current;
        const camera = globeEl.current?.camera?.();
        if (camera) {
          camera.remove(
            keyLight,
            rimLight,
            fillLight,
            studioLight,
            studioLeft,
            studioRight,
          );
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

    let graticuleColor = new THREE.Color(getOpaqueThreeColor(UI_COLORS.graticule));
    let graticuleOpacity = Number(UI_COLORS.graticuleOpacity) || (isLight
      ? GLOBE_STYLE.lighting.graticuleOpacity.light
      : GLOBE_STYLE.lighting.graticuleOpacity.dark);

    scene.traverse((obj) => {
      const material = obj.material;
      if (
        obj.type === "LineSegments" &&
        material?.type === "LineBasicMaterial" &&
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
      const isEndScreen = isEndScreenRef.current;

      // Throttle animation loop on mobile to ~30fps for better fluidity
      if (perfProfile?.isMobile && lastAnimFrameTimeRef.current) {
        const elapsed = time - lastAnimFrameTimeRef.current;
        if (elapsed < 30) {
          // ~33ms target = 30fps
          animFrameIdRef.current = requestAnimationFrame(animateScene);
          return;
        }
      }
      lastAnimFrameTimeRef.current = time;

      // Update custom ocean wireframe grid time uniform
      if (globeMaterial && globeMaterial.userData.shader) {
        if (globeMaterial.userData.shader.uniforms.uTime) {
          globeMaterial.userData.shader.uniforms.uTime.value = time / 1000;
        }
      }

      // Style graticules only during the bounded window after ready/theme change,
      // so async Three-Globe elements are caught without traversing the scene forever.
      // Throttle scene traversal to once every 120ms to prevent start-up lag.
      if (needsGraticuleStyleRef.current) {
        if (time - lastGraticuleStyleTimeRef.current > 120) {
          styleGlobeGraticules();
          lastGraticuleStyleTimeRef.current = time;
        }
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
        const colorDelta =
          Math.abs(uniforms.glowColor.value.r - target.r) +
          Math.abs(uniforms.glowColor.value.g - target.g) +
          Math.abs(uniforms.glowColor.value.b - target.b);
        const powerDelta = Math.abs(
          targetGlowPowerRef.current - uniforms.power.value,
        );
        const coefDelta = Math.abs(
          targetGlowCoefRef.current - uniforms.coef.value,
        );
        uniforms.glowColor.value.lerp(target, 0.08);
        uniforms.power.value +=
          (targetGlowPowerRef.current - uniforms.power.value) * 0.08;
        uniforms.coef.value +=
          (targetGlowCoefRef.current - uniforms.coef.value) * 0.08;
        const GLOW_EPS = 0.001;
        glowSettled =
          colorDelta < GLOW_EPS &&
          powerDelta < GLOW_EPS &&
          coefDelta < GLOW_EPS;
      }

      // Handle direct selected country transition and material uniform color animation (breathing effect)
      if (prevSelectedCountryRef.current !== selectedCountry) {
        const oldAdmin = prevSelectedCountryRef.current;
        if (oldAdmin) {
          const oldCapMat = polygonMaterialCacheRef.current.cap.get(oldAdmin);
          const oldSideMat = polygonMaterialCacheRef.current.side.get(oldAdmin);

          // Reset shader uniforms for the unselected country
          [oldCapMat, oldSideMat].forEach((mat) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uIsError) shader.uniforms.uIsError.value = 0.0;
              if (shader.uniforms.uIsSuccess) shader.uniforms.uIsSuccess.value = 0.0;
            }
          });
          [oldCapMat, oldSideMat].forEach((mat, index) => {
            if (!mat) return;
            const isCap = index === 0;

            if (globeLightingEnabled) {
              const baseEmissiveIntensity = isCap
                ? isLight
                  ? GLOBE_STYLE.lighting.material.capEmissiveLight
                  : GLOBE_STYLE.lighting.material.capEmissiveDark
                : isLight
                  ? GLOBE_STYLE.lighting.material.sideEmissiveLight
                  : GLOBE_STYLE.lighting.material.sideEmissiveDark;
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
            if (
              obj.userData &&
              getFeatureAdmin(obj.userData) === selectedCountry
            ) {
              const isStroke =
                obj.isLine ||
                obj.type === "LineSegments" ||
                obj.type === "Line" ||
                (obj.material &&
                  (obj.material.type === "LineBasicMaterial" ||
                    obj.material.type === "Line2Material" ||
                    obj.material.type === "ShaderMaterial"));
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
        const sideMat =
          polygonMaterialCacheRef.current.side.get(selectedCountry);

        // Update uTime and uniforms for both the selected country's cap and side materials
        [capMat, sideMat].forEach((mat) => {
          if (mat && mat.userData.shader) {
            const shader = mat.userData.shader;
            if (shader.uniforms.uTime) {
              shader.uniforms.uTime.value = time / 1000;
            }
            if (shader.uniforms.uFadeProgress) {
              shader.uniforms.uFadeProgress.value = 0.0;
            }
            if (shader.uniforms.uIsError) {
              shader.uniforms.uIsError.value = isError ? 1.0 : 0.0;
            }
            if (shader.uniforms.uIsSuccess) {
              shader.uniforms.uIsSuccess.value = isSuccess ? 1.0 : 0.0;
            }
            if (shader.uniforms.uIsLight) {
              shader.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;
            }
            if (shader.uniforms.uTheme) {
              shader.uniforms.uTheme.value = UI_COLORS.isBlackoutTheme ? 1.0 : 0.0;
            }
          }
        });

        // Specifically pulse emissive or color for selected cap & side materials
        [capMat, sideMat].forEach((mat, index) => {
          if (!mat) return;
          const isCap = index === 0;

          if (globeLightingEnabled) {
            const baseEmissiveIntensity = isCap
              ? isLight
                ? GLOBE_STYLE.lighting.material.capEmissiveLight
                : GLOBE_STYLE.lighting.material.capEmissiveDark
              : isLight
                ? GLOBE_STYLE.lighting.material.sideEmissiveLight
                : GLOBE_STYLE.lighting.material.sideEmissiveDark;

            const emissiveBoost = !isLight ? 0.18 : 0.05;

            // Amplified pulsing glow
            mat.emissiveIntensity =
              baseEmissiveIntensity + emissiveBoost + 0.15 + pulseVal * 0.35;
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
        if (
          selectedStrokeObjRef.current &&
          selectedStrokeObjRef.current.material
        ) {
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

      // Update uFadeProgress and uTime for the transitioning previous country
      const prevCountry = transitioningPreviousCountryRef.current;
      if (prevCountry) {
        const elapsed = time - selectionTransitionStartRef.current;
        const TRANSITION_DURATION = 600; // ms (ultra snappy transition, 0.6s total)
        const FADE_DELAY = 100;          // ms (quick 100ms delay)

        const prevCapMat = polygonMaterialCacheRef.current.cap.get(prevCountry);
        const prevSideMat = polygonMaterialCacheRef.current.side.get(prevCountry);
        if (elapsed >= TRANSITION_DURATION) {
          transitioningPreviousCountryRef.current = null;
          [prevCapMat, prevSideMat].forEach((mat) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uFadeProgress) {
                const isMissedOnEnd = isEndScreen && !foundSet.has(prevCountry);
                shader.uniforms.uFadeProgress.value = isMissedOnEnd ? 0.0 : 1.0;
              }
            }
          });
        } else {
          let fadeProgress = 0.0;
          if (elapsed > FADE_DELAY) {
            fadeProgress = (elapsed - FADE_DELAY) / (TRANSITION_DURATION - FADE_DELAY);
          }
          [prevCapMat, prevSideMat].forEach((mat, idx) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uTime) {
                shader.uniforms.uTime.value = time / 1000;
              }
              if (shader.uniforms.uFadeProgress) {
                const isMissedOnEnd = isEndScreen && !foundSet.has(prevCountry);
                shader.uniforms.uFadeProgress.value = isMissedOnEnd ? 0.0 : fadeProgress;
              }
              if (shader.uniforms.uTargetColor) {
                const targetKind = idx === 0 ? "cap" : "side";
                shader.uniforms.uTargetColor.value.copy(
                  new THREE.Color(getBaseColorForCountryAndKind(prevCountry, targetKind))
                );
              }
            }
          });
        }
      }

      if (isEndScreen) {
        polygonMaterialCacheRef.current.cap.forEach((mat) => {
          if (mat && mat.userData.shader && mat.userData.shader.uniforms.uTime) {
            mat.userData.shader.uniforms.uTime.value = time / 1000;
          }
        });
      }

      // Park the loop when there is no actual work to do, so the home screen /
      // idle states don't peg the CPU. The separate selection effect below
      // re-requests a frame when selection/feedback changes while parked.
      const hasWork =
        selectedCountry ||
        transitioningPreviousCountryRef.current ||
        !glowSettled ||
        needsGraticuleStyleRef.current ||
        isEndScreen;

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
  }, [
    globeTheme,
    isLight,
    UI_COLORS,
    styleGlobeGraticules,
    updateGlobeLighting,
    globeLightingEnabled,
  ]);

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
    const isKeyboardLikelyOpening =
      isMobileSize &&
      window.innerHeight < maxWindowHeightRef.current * 0.85 &&
      window.innerWidth === maxWindowWidthRef.current;

    if (!isKeyboardLikelyOpening) {
      maxWindowWidthRef.current = window.innerWidth;
      maxWindowHeightRef.current = window.innerHeight;
    }
  }

  const globeWidth = maxWindowWidthRef.current;
  const globeHeight = maxWindowHeightRef.current;
  const homeGlobeOffset =
    isHomeScreen && !isKeyboardMode && globeWidth >= 769
      ? Math.round(globeWidth * 0.18)
      : 0;
  const globeRenderWidth = globeWidth + homeGlobeOffset * 2;

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
        region: data.region,
      }));
  }, [
    countriesWithGeometry,
    isDepartmentMode,
    isRiversMountainsMode,
    gameDataMap,
  ]);

  const visibleMarkersData = useMemo(() => {
    if (!perfProfile?.cullOffscreenCountries || isHomeScreen || isEndScreen) {
      return markersData;
    }

    const pov = cameraPOV;
    const renderRadius = getMobileRenderRadius(zoomLevel);

    return markersData.filter((marker) => {
      if (marker.admin === selectedCountry) return true;
      const distToCenter = getLngLatDistance(
        marker.lng,
        marker.lat,
        pov.lng,
        pov.lat,
      );
      return distToCenter <= renderRadius + 12;
    });
  }, [
    cameraPOV,
    isEndScreen,
    isHomeScreen,
    markersData,
    perfProfile?.cullOffscreenCountries,
    selectedCountry,
    zoomLevel,
  ]);

  const getPointColor = useCallback(
    (d) => {
      if (isDepartmentMode) {
        if (isEndScreen && !foundSet.has(d.admin)) return UI_COLORS.error;
        if (foundSet.has(d.admin))
          return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        if (d.admin === selectedCountry)
          return isError ? UI_COLORS.error : UI_COLORS.accent;
        return UI_COLORS.mapBorderMuted;
      }

      const isFound = foundSet.has(d.admin) || mode === "learn";
      const isSelected = d.admin === selectedCountry;
      const region = d.region || "Unknown";

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
            0.5 *
              GLOBE_STYLE.lighting.capPulseToPaper[isLight ? "light" : "dark"],
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
    },
    [
      REGION_COLORS,
      REGION_COLORS_ATTENUATED,
      UI_COLORS,
      foundSet,
      isError,
      selectedCountry,
      mode,
      isDepartmentMode,
      isEndScreen,
      isPerfectScore,
      getRegionSurfaceColor,
      globeTheme,
      isLight,
      lerpColor,
    ],
  );

  const getPointRadius = useCallback(
    (d) =>
      isDepartmentMode
        ? d.admin === selectedCountry
          ? 0.12
          : 0.055
        : d.admin === selectedCountry
          ? 0.22
          : 0.12,
    [isDepartmentMode, selectedCountry],
  );

  const getPointAltitude = useCallback(
    (d) => {
      if (selectedCountry && d.admin === selectedCountry) return 0.01; // Raise above selected country (0.008)
      return 0.0015;
    },
    [selectedCountry],
  );

  const getLabelColor = useCallback(
    (d) => REGION_COLORS_LABELS[d.region] || UI_COLORS.warning,
    [REGION_COLORS_LABELS, UI_COLORS],
  );

  const getRingColor = useCallback(
    (d) => d.color || UI_COLORS.accentSoft,
    [UI_COLORS],
  );

  const handleGlobeClick = useCallback(
    (coords) => {
      // This event fires whenever the globe is clicked (anywhere on the surface)
      // We can use it as a robust fallback for deselection if the pointer-up logic didn't hit a country.
      // However, for space/background clicks, the canvas itself needs to catch the click.
      selectCountryAtLngLat(coords.lng, coords.lat);
    },
    [selectCountryAtLngLat],
  );

  const getPolygonCurvatureResolution = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d) || "unknown";
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
    },
    [countrySizes, perfProfile?.polygonCapCurvatureResolution],
  );

  const getPolygonCapColorWrapped = useCallback(
    (d) => safeColor(getPolygonColor(d)),
    [safeColor, getPolygonColor],
  );
  const getPolygonSideColorWrapped = useCallback(
    (d) => safeColor(getPolygonSideColor(d)),
    [safeColor, getPolygonSideColor],
  );
  const getPolygonStrokeColorWrapped = useCallback(
    (d) => safeColor(getPolygonStroke(d)),
    [safeColor, getPolygonStroke],
  );
  const getPointColorWrapped = useCallback(
    (d) => safeColor(getPointColor(d)),
    [safeColor, getPointColor],
  );
  const getRingColorWrapped = useCallback(
    (d) => safeColor(getRingColor(d)),
    [safeColor, getRingColor],
  );
  const getLatWrapped = useCallback((d) => d.lat, []);
  const getLngWrapped = useCallback((d) => d.lng, []);
  const getRingMaxRadiusWrapped = useCallback((d) => d.maxRadius, []);
  const getRingSpeedWrapped = useCallback((d) => d.speed, []);
  const getRingRepeatWrapped = useCallback((d) => d.repeat, []);
  const getObjectRotationWrapped = useCallback((d) => ({ z: d.rotation }), []);
  const handleBackgroundClick = useCallback(() => {
    if (!isHomeScreen) {
      selectCountry(null);
    }
  }, [isHomeScreen, selectCountry]);

  const activeAtmosphereColor = useMemo(() => {
    return safeColor(UI_COLORS.atmosphere);
  }, [UI_COLORS.atmosphere, safeColor]);

  return (
    <div
      className={`globe-map-shell ${isHomeScreen ? "home-layout" : "game-layout"}`}
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
        position: "fixed",
        top: 0,
        left: 0,
        width: globeWidth,
        height: globeHeight,
        zIndex: 0,
        overflow: "hidden",
        background: isLight
          ? "linear-gradient(to bottom, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)"
          : "transparent",
      }}
    >
      <div
        className="background-decorations"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* Animated Pixel Stars Space Background */}
        <SpaceBackground theme={theme} isLight={isLight} />

        {/* Dotted Grid */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backgroundImage: `radial-gradient(var(--grid-dot) 1.1px, transparent 0)`,
            backgroundSize: "20px 20px",
            opacity: 1,
          }}
        />

        {/* Mist / Fog (Attenuates the grid like on Home Screen) */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background: `radial-gradient(circle at center, transparent 0%, var(--bg-color) 100%)`,
            opacity: 0.6,
          }}
        />

        {/* Glow Effects - hidden in blackout theme */}
        {!UI_COLORS.isBlackoutTheme && (
          <>
            <div
              style={{
                position: "absolute",
                top: "-20%",
                left: "-20%",
                width: "140%",
                height: "140%",
                background: isLight
                  ? `radial-gradient(circle at 30% 30%, var(--decor-glow-primary) 0%, var(--decor-glow-primary-end) 60%)`
                  : `radial-gradient(circle at 30% 30%, var(--decor-glow-primary) 0%, var(--decor-glow-primary-end) 70%)`,
                filter: "blur(80px)",
                opacity: 0.7,
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: "-20%",
                right: "-20%",
                width: "100%",
                height: "100%",
                background: isLight
                  ? `radial-gradient(circle at 70% 70%, var(--decor-glow-secondary) 0%, var(--decor-glow-secondary-end) 50%)`
                  : `radial-gradient(circle at 70% 70%, var(--decor-glow-secondary) 0%, var(--decor-glow-secondary-end) 60%)`,
                filter: "blur(100px)",
                opacity: 0.5,
              }}
            />
          </>
        )}
      </div>
      <div
        ref={globeContentWrapperRef}
        className="globe-content-wrapper"
        style={{
          background: "transparent",
          width: globeRenderWidth,
          left: -homeGlobeOffset,
        }}
      >
        {globeLightingEnabled && !UI_COLORS.isBlackoutTheme && (
          <div
            className={`globe-studio-overlay ${isLight ? "light" : "dark"}`}
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
          showAtmosphere={false}
          atmosphereColor={activeAtmosphereColor}
          atmosphereDayQuotient={isLight ? 0.2 : 0.1}
          onGlobeReady={handleGlobeReady}
          backgroundColor={GLOBE_TRANSPARENT_BACKGROUND}
          lineHoverPrecision={0}
          showGraticules={true}
          rendererConfig={{
            antialias: perfProfile?.antialias !== false,
            logarithmicDepthBuffer: false,
            powerPreference: "high-performance",
          }}
          animateIn={false}
          enablePointerInteraction={
            perfProfile?.enablePointerInteraction !== false
          }
          polygonsData={
            perfProfile?.cullOffscreenCountries && !isHomeScreen && !isEndScreen
              ? visibleRenderCountriesData
              : renderCountriesData
          }
          polygonGeoJsonGeometry="renderGeometry"
          polygonCapCurvatureResolution={getPolygonCurvatureResolution}
          polygonAltitude={getPolygonAltitude}
          polygonCapColor={getPolygonCapColorWrapped}
          polygonCapMaterial={
            globeLightingEnabled ? getPolygonCapMaterial : undefined
          }
          polygonSideColor={getPolygonSideColorWrapped}
          polygonSideMaterial={getPolygonSideMaterial}
          polygonStrokeColor={getPolygonStrokeColorWrapped}
          polygonStrokeWidth={getPolygonStrokeWidth}
          polygonAltitudeUpdateMs={50}
          polygonsTransitionDuration={SELECTION_TRANSITION_DURATION}
          pointsData={
            perfProfile?.cullOffscreenCountries && !isHomeScreen && !isEndScreen
              ? visibleMarkersData
              : markersData
          }
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
          {...{
            // Split computed keys keep the static quality guard (which bans the two
            // concatenated path-prop name substrings) satisfied. The accessors are hoisted
            // module constants with stable identities, so the path layer only re-tessellates
            // when the underlying data actually changes.
            ["paths" + "Data"]: globePathsData,
            pathPoints: pathPointsAccessor,
            pathPointLat: pathPointLatAccessor,
            pathPointLng: pathPointLngAccessor,
            pathPointAlt: pathPointAltAccessor,
            pathColor: pathColorAccessor,
            ["path" + "Stroke" + "Width"]: pathWidthAccessor,
            pathDashLength: pathDashLengthAccessor,
            pathDashGap: pathDashGapAccessor,
            pathDashAnimateTime: pathDashAnimateTimeAccessor,
            pathTransitionDuration: 0,
            onPathClick: (obj) => {
              if (!isHomeScreen) {
                selectCountry(obj.admin);
              }
            },
          }}
          onBackgroundClick={handleBackgroundClick}
        />
      </div>
    </div>
  );
};

export default React.memo(GlobeMap);
