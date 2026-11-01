import "./GlobeMap.css";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import Globe from "react-globe.gl";

import SpaceBackground from "../components/SpaceBackground";
import {
  getOpaqueThreeColor,
  GLOBE_STYLE,
  GLOBE_TRANSPARENT_BACKGROUND,
} from "../config/designSystem";
import { DEFAULT_LEARN_SUB_MODE, GLITCH_SELECTION_TRANSITION_MS } from "../config/gameConfig";
import { useTranslation } from "../config/i18n";
import { resolveEffectiveMode } from "./effectiveMode";
import { useFoundProgramWarmup } from "./hooks/useFoundProgramWarmup";
import { useGlobeBoats } from "./hooks/useGlobeBoats";
import { useGlobeCamera } from "./hooks/useGlobeCamera";
import { useGlobeInteractions } from "./hooks/useGlobeInteractions";
import { useGlobeLabels } from "./hooks/useGlobeLabels";
import {
  useGlobeContextLoss,
  useGlobeNativeTouch,
  useGlobeVisibilityPause,
} from "./hooks/useGlobeLifecycle";
import { useGlobeLighting } from "./hooks/useGlobeLighting";
import { useGlobeMapData } from "./hooks/useGlobeMapData";
import { useGlobeMarkers } from "./hooks/useGlobeMarkers";
import { useGlobeMaterial } from "./hooks/useGlobeMaterial";
import { useGlobePanelShift } from "./hooks/useGlobePanelShift";
import { useGlobePolygons } from "./hooks/useGlobePolygons";
import { useGlobeRenderPipeline } from "./hooks/useGlobeRenderPipeline";
import { useGlobeRings } from "./hooks/useGlobeRings";
import { useGlobeSceneAnimation } from "./hooks/useGlobeSceneAnimation";
import { useGlobeSelectionTransition } from "./hooks/useGlobeSelectionTransition";
import { useGlobeShaderWarmup } from "./hooks/useGlobeShaderWarmup";
import { useMicroBeacons } from "./hooks/useMicroBeacons";
import { usePolygonMaterialEviction } from "./hooks/usePolygonMaterialEviction";
import { clearFeatureMask, setFeatureMask } from "./render/featureMask";
import { isGlobeHoverRaycastNeeded } from "./render/pointerRaycast";
import { polygonGlitchUniforms } from "./render/polygonGlitchShader";

// Module-level for a stable identity (an inline arrow rebuilt the lighting rig each render).
const safeOpaqueColor = (c) => getOpaqueThreeColor(c);

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
    viewport,
    isError,
    isSuccess,
    perfProfile,
    isHomeScreen,
    isKeyboardMode,
    isEndScreen,
    isPerfectScore,
    onPreserveInputFocus,
    globeLightingEnabled = true,
    activeDataMap,
    learnSubMode = DEFAULT_LEARN_SUB_MODE,
    isPanelOpen = false,
  } = props;
  const t = useTranslation(lang);

  const globeEl = useRef();
  const globeContainerRef = useRef(null);
  const globeContentWrapperRef = useRef(null);
  const lastCameraPOVRef = useRef({ lat: 0, lng: 0 });
  const lastZoomRef = useRef(2.5);
  const canonicalRef = useRef({});

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

  const selectionTransition = useGlobeSelectionTransition(selectedCountry, mode, gameDataMap);

  const {
    selectableFeatureIndex,
    countrySizes,
    countriesWithGeometry,
    canonicalPositions,
    polygonsData,
    modeTransitionRef,
    transitionStep,
    transitionLive,
    effectiveDepartmentMode = isDepartmentMode,
    effectiveUsStatesMode = isUsStatesMode,
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
  const { effectiveMode, effectiveGameDataMap } = resolveEffectiveMode({
    mode,
    gameDataMap,
    effectiveDepartmentMode,
    effectiveUsStatesMode,
  });
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
    mode: effectiveMode,
    globeLightingEnabled,
    perfProfile,
    selectedCountry,
    foundSet,
    foundList,
    conquestOverlay: props.conquestOverlay,
    isHomeScreen,
    isEndScreen,
    isDepartmentMode: effectiveDepartmentMode,
    isUsStatesMode: effectiveUsStatesMode,
    isRiversMountainsMode,
    isPerfectScore,
    isError,
    isSuccess,
    selectionTransition,
    gameDataMap: effectiveGameDataMap,
    modeTransitionRef,
    transitionStep,
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
    globeLightingEnabled,
    UI_COLORS,
    perfProfile,
    safeColor: safeOpaqueColor,
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
    handlePointerLeave,
    handlePointerUp,
    handleBackgroundClick,
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

  useGlobeNativeTouch(globeContainerRef, { handleTouchStart, handleTouchMove, handleTouchEnd });
  useGlobeVisibilityPause(globeEl);
  // Pixel beacons on every micro-territory (lazy layer, world modes only).
  useMicroBeacons(globeEl, {
    foundList,
    enabled: !isHomeScreen && !isDepartmentMode && !isUsStatesMode && !isRiversMountainsMode,
  });
  useGlobeShaderWarmup(
    globeEl,
    `${mode}|${learnSubMode}|${isHomeScreen}|${isEndScreen}|${selectedCountry}|${isError}|${isSuccess}`
  );

  // Life: pixel boats between found coastal countries (lazy, world modes only).
  useGlobeBoats(globeEl, {
    foundList,
    enabled: !isHomeScreen && !isDepartmentMode && !isUsStatesMode && mode !== "learn",
  });

  // First correct answer: link the opaque "success" programs ahead of time.
  useFoundProgramWarmup(globeEl, {
    active: !isHomeScreen && !isEndScreen && Boolean(selectedCountry) && foundList.length === 0,
  });

  // Release per-country ignite/selection materials once no mesh uses them.
  usePolygonMaterialEviction(
    globeEl,
    sharedMaterialsRef,
    polygonMaterialCacheRef,
    `${foundList.length}|${selectedCountry}`
  );

  useEffect(() => {
    polygonGlitchUniforms.uFeatureMode.value = isRiversMountainsMode ? 1.0 : 0.0;
  }, [isRiversMountainsMode]);

  useEffect(() => {
    if (isRiversMountainsMode) {
      setFeatureMask({
        selectedKey: selectedCountry,
        foundKeys: foundSet,
        dataMap: gameDataMap,
      });
    } else {
      clearFeatureMask();
    }
  }, [isRiversMountainsMode, selectedCountry, foundSet, gameDataMap]);

  useEffect(() => {
    return () => {
      clearFeatureMask();
    };
  }, []);

  const { markersData, getPointColorWrapped, getPointRadius, getPointAltitude } = useGlobeMarkers({
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
    canonicalPositions,
    gameDataMap,
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
    t,
    globeEl,
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
    extraRings: props.conquestOverlay?.rings,
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
    countriesWithGeometry,
  });

  const globeMaterial = useGlobeMaterial({ UI_COLORS });

  const lightingGlowConfig = {
    globeLightingRef,
    targetGlowColorRef,
    targetGlowPowerRef,
    targetGlowCoefRef,
  };
  const stylesAndHelpersConfig = {
    GLOBE_STYLE,
    UI_COLORS,
    lerpColor,
    getBaseColorForCountryAndKind,
  };
  useGlobeSceneAnimation({
    ...props,
    ...lightingGlowConfig,
    ...stylesAndHelpersConfig,
    globeEl,
    polygonMaterialCacheRef,
    sharedMaterialsRef,
    selectionTransition,
    foundSet,
    globeMaterial,
    modeTransitionRef,
    gameDataMap,
    styleGlobeGraticules,
    updateGlobeLighting,
  });

  const getLatWrapped = useCallback((d) => d.lat, []);
  const getLngWrapped = useCallback((d) => d.lng, []);

  const attachContextLossHandlers = useGlobeContextLoss(globeEl);

  const handleGlobeReady = useCallback(() => {
    attachContextLossHandlers();
    styleGlobeGraticules();
    updateGlobeLighting();
    if (typeof window !== "undefined") {
      window.__TVRS_GLOBE_EL__ = globeEl.current;
      window.__TVRS_SHARED_MATERIALS__ = sharedMaterialsRef.current;
    }
  }, [attachContextLossHandlers, styleGlobeGraticules, updateGlobeLighting, sharedMaterialsRef]);

  if (typeof window !== "undefined") {
    window.__TVRS_SHARED_MATERIALS__ = sharedMaterialsRef.current;
    if (globeEl.current) {
      window.__TVRS_GLOBE_EL__ = globeEl.current;
    }
  }

  // Hover raycast only where a click handler needs it (see pointerRaycast.js).
  const hoverRaycastEnabled = isGlobeHoverRaycastNeeded({
    isHomeScreen,
    isRiversMountainsMode,
    profileEnabled: perfProfile?.enablePointerInteraction,
  });
  useEffect(() => {
    if (hoverRaycastEnabled) return;
    // globe.gl keeps its "clickable" pointer cursor until the next hover event,
    // which never comes once the raycast is off.
    globeEl.current?.renderer?.()?.domElement?.classList.remove("clickable");
  }, [hoverRaycastEnabled]);

  const activeAtmosphereColor = useMemo(
    () => getOpaqueThreeColor(UI_COLORS.atmosphere),
    [UI_COLORS.atmosphere]
  );

  // On-screen disc of the globe (viewport px), read by the backdrop so its
  // limb halo / vignette follow the globe offset and zoom. Pure camera math,
  // identical for the WebGL and WebGPU renderers.
  const getGlobeFrame = useCallback(() => {
    const globe = globeEl.current;
    const camera = globe?.camera?.();
    const canvas = globe?.renderer?.()?.domElement;
    if (!camera || !canvas || !camera.isPerspectiveCamera) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const radius = globe.getGlobeRadius?.() || 100;
    const dist = camera.position.length();
    if (dist <= radius) return null;
    const center = camera.position.clone().set(0, 0, 0).project(camera);
    const halfFov = (camera.fov * Math.PI) / 360;
    const angular = Math.asin(radius / dist);
    return {
      cx: rect.left + ((center.x + 1) / 2) * rect.width,
      cy: rect.top + ((1 - center.y) / 2) * rect.height,
      r: (Math.tan(angular) / Math.tan(halfFov)) * (rect.height / 2),
    };
  }, []);

  return (
    <div
      className={`globe-map-shell ${isHomeScreen ? "home-layout" : "game-layout"} ${isPanelOpen ? "panel-open" : ""}`}
    >
      <div
        className="globe-container globe-stage"
        ref={globeContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
      >
        <div className="globe-backdrop">
          <SpaceBackground getGlobeFrame={getGlobeFrame} />
          <div className="globe-backdrop-grid" />

          <div className="globe-backdrop-vignette" />
          {/* The two 80 px and 100 px blurred decorative gradients were removed:
              their `--decor-glow-*` variables are defined nowhere, so they painted
              nothing (background: none) while still costing a full-screen blur layer. */}
        </div>
        <div
          ref={globeContentWrapperRef}
          className="globe-content-wrapper"
          style={{
            background: "transparent",
            width: globeRenderWidth,
            left: -homeGlobeOffset,
            "--globe-panel-shift": `${globePanelShift.x}px`,
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
            atmosphereDayQuotient={0.1}
            onGlobeReady={handleGlobeReady}
            backgroundColor={GLOBE_TRANSPARENT_BACKGROUND}
            lineHoverPrecision={0}
            showGraticules={true}
            rendererConfig={globeRendererConfig}
            animateIn={false}
            enablePointerInteraction={hoverRaycastEnabled}
            polygonsData={polygonsData}
            polygonGeoJsonGeometry="renderGeometry"
            polygonCapCurvatureResolution={getPolygonCurvatureResolution}
            polygonAltitude={getPolygonAltitude}
            polygonCapColor={getPolygonCapColorWrapped}
            polygonCapMaterial={globeLightingEnabled ? getPolygonCapMaterial : undefined}
            polygonSideColor={getPolygonSideColorWrapped}
            polygonSideMaterial={getPolygonSideMaterial}
            polygonStrokeColor={getPolygonStrokeColorWrapped}
            polygonStrokeWidth={getPolygonStrokeWidth}
            polygonAltitudeUpdateMs={50}
            // No altitude tween while a layer cross-fade is live (new polygons start at full height).
            polygonsTransitionDuration={transitionLive ? 0 : GLITCH_SELECTION_TRANSITION_MS}
            pointsData={markersData}
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
            onBackgroundClick={handleBackgroundClick}
          />
        </div>
      </div>
    </div>
  );
};
export default React.memo(GlobeMap);
