import "./GlobeMap.css";

import React, { useCallback, useMemo, useRef } from "react";
import Globe from "react-globe.gl";

import SpaceBackground from "../components/SpaceBackground";
import {
  getOpaqueThreeColor,
  GLOBE_STYLE,
  GLOBE_TRANSPARENT_BACKGROUND,
} from "../config/designSystem";
import { DEFAULT_LEARN_SUB_MODE, GLITCH_SELECTION_TRANSITION_MS } from "../config/gameConfig";
import { useTranslation } from "../config/i18n";
import { useGlobeBiomes } from "./hooks/useGlobeBiomes";
import { useGlobeCamera } from "./hooks/useGlobeCamera";
import { useGlobeInteractions } from "./hooks/useGlobeInteractions";
import { useGlobeLabels } from "./hooks/useGlobeLabels";
import { useGlobeLighting } from "./hooks/useGlobeLighting";
import { useGlobeMapData } from "./hooks/useGlobeMapData";
import { useGlobeMarkers } from "./hooks/useGlobeMarkers";
import { useGlobeMaterial } from "./hooks/useGlobeMaterial";
import { useGlobePanelShift } from "./hooks/useGlobePanelShift";
import {
  pathColorAccessor,
  pathDashAnimateTimeAccessor,
  pathDashGapAccessor,
  pathDashLengthAccessor,
  pathPointAltAccessor,
  pathPointLatAccessor,
  pathPointLngAccessor,
  pathPointsAccessor,
  pathWidthAccessor,
  useGlobePaths,
} from "./hooks/useGlobePaths";
import { useGlobePolygons } from "./hooks/useGlobePolygons";
import { useGlobeRenderPipeline } from "./hooks/useGlobeRenderPipeline";
import { useGlobeRings } from "./hooks/useGlobeRings";
import { useGlobeSceneAnimation } from "./hooks/useGlobeSceneAnimation";
import { useGlobeSelectionTransition } from "./hooks/useGlobeSelectionTransition";
import {
  BatchedGlobeEngine,
  buildBatchedGlobeGeometry,
  createBatchedGlobeMaterial,
} from "./render/globePolygonMaterial";
import { mountainGlitchUniforms } from "./render/LowPolyBiomes";

const GlobeMap = (props) => {
  const {
    mode,
    lang,
    countriesData,
    departmentsData = [],
    usStatesData = [],
    foundList,
    onCountrySelect,
    shouldAutoRotate,
    selectedCountry,
    theme,
    viewport,
    isError,
    isSuccess,
    _hasActiveFeedback,
    perfProfile,
    isHomeScreen,
    isKeyboardMode,
    isEndScreen,
    isPerfectScore,
    onPreserveInputFocus,
    globeLightingEnabled = true,
    activeDataMap,
    globeTheme = "satellite",
    learnSubMode = DEFAULT_LEARN_SUB_MODE,
    isPanelOpen = false,
    globeFeedbackRef,
    globeFeedbackApplierRef,
  } = props;
  const t = useTranslation(lang);

  const globeEl = useRef();
  const globeContentWrapperRef = useRef(null);
  const lastCameraPOVRef = useRef({ lat: 0, lng: 0 });
  const lastZoomRef = useRef(2.5);
  const canonicalRef = useRef({});

  const _batchedEngineRef = useRef({
    Engine: BatchedGlobeEngine,
    buildGeometry: buildBatchedGlobeGeometry,
    createMaterial: createBatchedGlobeMaterial,
  });
  const selectionTransition = useGlobeSelectionTransition();

  const {
    isDepartmentMode,
    isUsStatesMode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    globeRendererConfig,
  } = useGlobeMapData({
    mode,
    isHomeScreen,
    learnSubMode,
    activeDataMap,
    foundList,
    perfProfile,
  });

  const isLight = theme === "light";

  const {
    getPolygonCapMaterial,
    getPolygonSideMaterial,
    getPolygonAltitude,
    getPolygonStrokeWidth,
    getPolygonCurvatureResolution,
    getPolygonCapColorWrapped,
    getPolygonSideColorWrapped,
    getPolygonStrokeColorWrapped,
    polygonMaterialCacheRef,
    sharedMaterialsRef,
    REGION_COLORS,
    REGION_COLORS_LABELS,
    UI_COLORS,
    getBaseColorForCountryAndKind,
    lerpColor,
  } = useGlobePolygons({
    mode,
    theme,
    globeTheme,
    isLight,
    globeLightingEnabled,
    perfProfile,
    selectedCountry,
    foundSet,
    foundList,
    isHomeScreen,
    isEndScreen,
    isDepartmentMode,
    isUsStatesMode,
    isPerfectScore,
    isError,
    isSuccess,
    selectionTransition,
    gameDataMap,
  });

  const {
    updateGlobeLighting,
    styleGlobeGraticules,
    globeLightingRef,
    targetGlowColorRef,
    targetGlowPowerRef,
    targetGlowCoefRef,
  } = useGlobeLighting({
    globeEl,
    isLight,
    globeLightingEnabled,
    UI_COLORS,
    perfProfile,
    globeTheme,
    safeColor: (c) => getOpaqueThreeColor(c),
  });

  const {
    selectableFeatureIndex,
    countrySizes,
    _renderCountriesData,
    _visibleRenderCountriesData,
    countriesWithGeometry,
    canonicalPositions,
    polygonsData,
  } = useGlobeRenderPipeline({
    isDepartmentMode,
    isUsStatesMode,
    isHomeScreen,
    isEndScreen,
    countriesData,
    departmentsData,
    usStatesData,
    gameDataMap,
    selectedCountry,
    lastCameraPOVRef,
    lastZoomRef,
    perfProfile,
    canonicalRef,
  });

  const { zoomLevel, cameraPOV, globeRenderWidth, globeHeight, homeGlobeOffset, globePanelShift } =
    useGlobeCamera({
      globeEl,
      selectedCountry,
      shouldAutoRotate,
      viewport,
      isHomeScreen,
      isKeyboardMode,
      isEndScreen,
      learnSubMode,
      gameDataMap,
      perfProfile,
      isPanelOpen,
      mode,
      selectionTransition,
      canonicalPositions: canonicalRef.current,
    });

  useGlobePanelShift(globePanelShift, globeContentWrapperRef);

  // Stash fresh POV/zoom for next render's renderData call.
  lastCameraPOVRef.current = cameraPOV;
  lastZoomRef.current = zoomLevel;

  const isRegionalMode = isDepartmentMode || isUsStatesMode;

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleBackgroundClick,
    selectCountry,
  } = useGlobeInteractions({
    globeEl,
    globeContentWrapperRef,
    isHomeScreen,
    isKeyboardMode,
    viewport,
    perfProfile,
    onCountrySelect,
    onPreserveInputFocus,
    mode,
    gameDataMap,
    selectableFeatureIndex,
    isDepartmentMode: isRegionalMode,
    isRiversMountainsMode,
  });

  const { globePathsData } = useGlobePaths({
    mode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    isHomeScreen,
    UI_COLORS,
    selectedCountry,
    isError,
  });

  const {
    visibleMarkersData,
    markersData,
    getPointColorWrapped,
    getPointRadius,
    getPointAltitude,
  } = useGlobeMarkers({
    mode,
    isDepartmentMode: isRegionalMode,
    isRiversMountainsMode,
    isHomeScreen,
    isEndScreen,
    selectedCountry,
    foundSet,
    countriesWithGeometry,
    cameraPOV,
    zoomLevel,
    perfProfile,
    UI_COLORS,
    isPerfectScore,
    isError,
    isLight,
    globeTheme,
    theme,
    canonicalPositions,
  });

  const { labelsData, createLabelElement, getHtmlAltitude } = useGlobeLabels({
    mode,
    isHomeScreen,
    isEndScreen,
    isDepartmentMode: isRegionalMode,
    isRiversMountainsMode,
    selectedCountry,
    foundSet,
    foundList,
    cameraPOV,
    zoomLevel,
    perfProfile,
    gameDataMap,
    learnSubMode,
    countrySizes,
    lang,
    isError,
    REGION_COLORS_LABELS,
    UI_COLORS,
    globeTheme,
    t,
    globeEl,
    isLight,
    isPanelOpen,
    canonicalPositions,
  });

  const {
    ringsData,
    getRingColorWrapped,
    getRingMaxRadiusWrapped,
    getRingSpeedWrapped,
    getRingRepeatWrapped,
    getSelectionEffectAltitude,
  } = useGlobeRings({
    mode,
    isDepartmentMode: isRegionalMode,
    isRiversMountainsMode,
    selectedCountry,
    isError,
    UI_COLORS,
    foundSet,
    isHomeScreen,
    REGION_COLORS_LABELS,
    REGION_COLORS,
    isLight,
    countriesWithGeometry,
  });

  const { getBiomeAssetsData, getBiomeAltitude, createBiomeThreeObject } = useGlobeBiomes({
    mode,
    gameDataMap,
    selectedCountry,
    foundSet,
    isHomeScreen,
    globeTheme,
    isRiversMountainsMode,
  });

  const globeMaterial = useGlobeMaterial({
    UI_COLORS,
    globeLightingEnabled,
    isLight,
  });

  useGlobeSceneAnimation({
    foundList,
    globeEl,
    isLight,
    UI_COLORS,
    globeTheme,
    globeLightingEnabled,
    perfProfile,
    globeLightingRef,
    targetGlowColorRef,
    targetGlowPowerRef,
    targetGlowCoefRef,
    styleGlobeGraticules,
    updateGlobeLighting,
    polygonMaterialCacheRef,
    sharedMaterialsRef,
    mode,
    selectedCountry,
    isError,
    isSuccess,
    isEndScreen,
    selectionTransition,
    foundSet,
    getBaseColorForCountryAndKind,
    lerpColor,
    globeMaterial,
    mountainGlitchUniforms,
    mountainGlitchActive: isRiversMountainsMode,
    GLOBE_STYLE,
    countriesData,
    departmentsData,
    globeFeedbackRef,
    globeFeedbackApplierRef,
  });

  const getPolygonCurvatureResolutionWrapped = useCallback(
    (d) => (d.isGhostCountry ? 1 : getPolygonCurvatureResolution(d)),
    [getPolygonCurvatureResolution]
  );

  const getObjectRotationWrapped = useCallback(() => [90, 0, 0], []);
  const getLatWrapped = useCallback((d) => d.lat, []);
  const getLngWrapped = useCallback((d) => d.lng, []);

  const handleGlobeReady = useCallback(() => {
    styleGlobeGraticules();
    updateGlobeLighting();
    if (typeof window !== "undefined") {
      window.__TVRS_GLOBE_EL__ = globeEl.current;
      window.__TVRS_SHARED_MATERIALS__ = sharedMaterialsRef.current;
    }
  }, [styleGlobeGraticules, updateGlobeLighting, sharedMaterialsRef]);

  if (typeof window !== "undefined") {
    window.__TVRS_SHARED_MATERIALS__ = sharedMaterialsRef.current;
    if (globeEl.current) {
      window.__TVRS_GLOBE_EL__ = globeEl.current;
    }
  }

  const activeAtmosphereColor = useMemo(
    () => getOpaqueThreeColor(UI_COLORS.atmosphere),
    [UI_COLORS.atmosphere]
  );

  return (
    <div
      className={`globe-map-shell ${isHomeScreen ? "home-layout" : "game-layout"} ${isPanelOpen ? "panel-open" : ""}`}
    >
      <div
        className={`globe-container ${theme}`}
        style={{ width: "100%", height: "100%", position: "relative" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <SpaceBackground theme={theme} isLight={isLight} />
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

          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: `radial-gradient(circle at center, transparent 0%, var(--bg-color) 100%)`,
              opacity: 0.6,
            }}
          />

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
            "--globe-panel-shift": `${globePanelShift}px`,
          }}
        >
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
            rendererConfig={globeRendererConfig}
            animateIn={false}
            enablePointerInteraction={perfProfile?.enablePointerInteraction !== false}
            polygonsData={polygonsData}
            polygonGeoJsonGeometry="renderGeometry"
            polygonCapCurvatureResolution={getPolygonCurvatureResolutionWrapped}
            polygonAltitude={getPolygonAltitude}
            polygonCapColor={getPolygonCapColorWrapped}
            polygonCapMaterial={globeLightingEnabled ? getPolygonCapMaterial : undefined}
            polygonSideColor={getPolygonSideColorWrapped}
            polygonSideMaterial={getPolygonSideMaterial}
            polygonStrokeColor={getPolygonStrokeColorWrapped}
            polygonStrokeWidth={getPolygonStrokeWidth}
            polygonAltitudeUpdateMs={50}
            polygonsTransitionDuration={GLITCH_SELECTION_TRANSITION_MS}
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
            pointsTransitionDuration={GLITCH_SELECTION_TRANSITION_MS}
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
              ["paths" + "Data"]: globePathsData,
              pathPoints: pathPointsAccessor,
              pathPointLat: pathPointLatAccessor,
              pathPointLng: pathPointLngAccessor,
              pathPointAlt: pathPointAltAccessor,
              pathColor: pathColorAccessor,
              ["path" + "Stroke"]: pathWidthAccessor,
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
    </div>
  );
};
export default React.memo(GlobeMap);
