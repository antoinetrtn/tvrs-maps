import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { countryDataMap } from "./data/gameData";
import { riversMountainsDataMap } from "./data/riversMountainsData";
import {
  GLOBE_STYLE,
  GLOBE_TRANSPARENT_BACKGROUND,
  getOpaqueThreeColor,
} from "./config/designSystem";
import {
  disposeBiomeCache,
  createMountainFeature,
  mountainGlitchUniforms,
} from "./utils/LowPolyBiomes";
import {
  RELIEF,
  DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS,
  GAME_REGIONS,
} from "./config/gameConfig";
import { useTranslation } from "./config/i18n";
import SpaceBackground from "./components/SpaceBackground";
import { createGlobeLabelElement } from "./utils/globeLabelBuilder";
import {
  getFlagEmoji,
  getFeaturePolygons,
  getRenderGeometry,
  getLngLatBounds,
  getLngLatDistance,
  getMobileRenderRadius,
  getLabelRenderRadius,
  getFeatureAdmin,
} from "./utils/utils";

import { useGlobeCamera } from "./hooks/useGlobeCamera";
import { useGlobeInteractions } from "./hooks/useGlobeInteractions";
import { useGlobeLighting } from "./hooks/useGlobeLighting";
import { useGlobeAnimationLoop } from "./hooks/useGlobeAnimationLoop";
import { useGlobePolygons } from "./hooks/useGlobePolygons";

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
    ([lat, lng]) => new THREE.Vector3(lat, lng, 0.006),
  );
  const curve = new THREE.CatmullRomCurve3(points);
  const smoothPoints = curve.getPoints(60);
  const result = smoothPoints.map((p) => [p.x, p.y, p.z]);

  smoothedRiversCache[riverKey] = result;
  return result;
};

const SELECTION_TRANSITION_DURATION = 80;
const BIOME_SCENE_SCALE = 9.2;
const BIOME_SURFACE_ALIGNMENT_RADIANS = Math.PI / 2;

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
  const isLearnRivers = mode === "learn" && learnShowRivers;
  const isLearnMountains = mode === "learn" && learnShowMountains;
  const t = useTranslation(lang);

  const globeEl = useRef();
  const globeContentWrapperRef = useRef(null);

  const transitioningPreviousCountryRef = useRef(null);
  const [transitioningPreviousCountryState, setTransitioningPreviousCountryState] = useState(null);
  const selectionTransitionStartRef = useRef(0);

  const isDepartmentMode = mode === "departments" && !isHomeScreen;
  const isRiversMountainsMode = mode === "rivers_mountains";
  const gameDataMap =
    isDepartmentMode || isRiversMountainsMode
      ? activeDataMap || {}
      : countryDataMap;

  const foundSet = useMemo(() => {
    if (isHomeScreen) {
      return new Set();
    }
    return new Set(foundList);
  }, [foundList, isHomeScreen]);

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
    REGION_COLORS_ATTENUATED,
    REGION_COLORS_LABELS,
    UI_COLORS,
    getBaseColorForCountryAndKind,
    getPolygonColor,
    getPolygonSideColor,
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
    isPerfectScore,
    isError,
    isSuccess,
    transitioningPreviousCountryState,
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
    selectedCountry,
    REGION_COLORS,
    safeColor: (c) => getOpaqueThreeColor(c),
  });

  const {
    zoomLevel,
    cameraPOV,
    maxWindowWidthRef,
    maxWindowHeightRef,
    getDepartmentModeFrancePointOfView,
  } = useGlobeCamera({
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
  });

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

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleBackgroundClick,
    selectCountry,
    resetGlobeNudge,
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
    isLearnRivers,
    isLearnMountains,
    learnToggles,
  });

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
      const isNight = UI_COLORS.globeTextureUrl.includes("earth-night");
      if (isNight) {
        return new THREE.MeshBasicMaterial({
          map: customGlobeTexture,
          color: 0xffffff,
        });
      }
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

  useGlobeAnimationLoop({
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
    selectedCountry,
    isError,
    isSuccess,
    isEndScreen,
    transitioningPreviousCountryState,
    selectionTransitionStartRef,
    transitioningPreviousCountryRef,
    setTransitioningPreviousCountryState,
    foundSet,
    getBaseColorForCountryAndKind,
    globeMaterial,
    mountainGlitchUniforms,
    GLOBE_STYLE,
    countriesData,
    departmentsData,
  });

  const getRegionSurfaceColor = useCallback(
    (region) => {
      return REGION_COLORS[region] || UI_COLORS.success;
    },
    [REGION_COLORS, UI_COLORS.success],
  );

  const lerpColor = useCallback(
    (a, b, amount) => {
      try {
        const colorA = getOpaqueThreeColor(a);
        const colorB = getOpaqueThreeColor(b);
        const lerpC1 = new THREE.Color(colorA);
        const lerpC2 = new THREE.Color(colorB);
        lerpC1.lerp(lerpC2, Math.max(0, Math.min(1, amount)));
        return `#${lerpC1.getHexString()}`;
      } catch (e) {
        return getOpaqueThreeColor(a);
      }
    },
    [],
  );

  const labelsCacheRef = useRef({});

  useEffect(() => {
    if (foundList.length === 0) {
      disposeBiomeCache();
    }
  }, [foundList]);

  useEffect(() => {
    return () => {
      disposeBiomeCache();
    };
  }, []);

  const riversBasePathsData = useMemo(() => {
    if (mode !== "rivers_mountains" && !isLearnRivers) return [];
    const paths = [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    Object.keys(dataMap).forEach((k) => {
      const data = dataMap[k];
      if (!data || data.type !== "river" || !data.path) return;
      const isFound = foundSet.has(k) || mode === "learn" || isHomeScreen;
      paths.push({
        admin: k,
        coords: getSmoothedRiverPath(k, data.path),
        color: isFound ? UI_COLORS.riverActive : UI_COLORS.riverInactive,
        width: isFound ? 45 : 24,
        dashLength: isFound ? 1 : 0.015,
        dashGap: isFound ? 0 : 0.012,
        dashAnimateTime: isFound ? 3000 : 0,
      });
    });
    return paths;
  }, [gameDataMap, foundSet, mode, isHomeScreen, UI_COLORS, isLearnRivers]);

  const riversSelectedPathData = useMemo(() => {
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
      {
        admin: selectedCountry,
        coords: smoothedPath.map((p) => [p[0], p[1], p[2] + 0.001]),
        color,
        width: isFound ? 75 : 65,
        dashLength: 1,
        dashGap: 0,
        dashAnimateTime: 0,
      },
      {
        admin: `${selectedCountry}_core`,
        coords: smoothedPath.map((p) => [p[0], p[1], p[2] + 0.002]),
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
    isLearnRivers,
  ]);

  const globePathsData = useMemo(
    () => [...riversBasePathsData, ...riversSelectedPathData],
    [riversBasePathsData, riversSelectedPathData],
  );

  const getBiomeAssetsData = useMemo(() => {
    if (mode === "rivers_mountains" || isLearnMountains) {
      const assets = [];
      const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;
      Object.keys(dataMap).forEach((k) => {
        const data = dataMap[k];
        if (!data || data.lat === undefined) return;
        if (data.type !== "mountain" && data.type !== "mountain_range") return;
        const isFound = foundSet.has(k) || mode === "learn" || isHomeScreen;
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
          region: data.region || "Unknown",
        });
      });
      return assets;
    }
    return [];
  }, [gameDataMap, mode, foundSet, isHomeScreen, isLearnMountains]);

  const getBiomeAltitude = useCallback(
    (d) => {
      const admin = d.admin;
      if (mode === "rivers_mountains" || isLearnMountains) {
        return admin === selectedCountry ? 0.003 : 0.0015;
      }
      return admin === selectedCountry ? 0.0025 : 0.0015;
    },
    [selectedCountry, mode, isLearnMountains],
  );

  const biomeObjectsCacheRef = useRef(new Map());

  const createBiomeThreeObject = useCallback(
    (d) => {
      const isSelected = d.admin === selectedCountry;
      const key = `${d.admin || "unknown"}_${d.isFound ? "found" : "unfound"}_selected_${isSelected}_${d.scale}_${d.lat}_${d.lng}_${globeTheme}`;

      if (biomeObjectsCacheRef.current.has(key)) {
        return biomeObjectsCacheRef.current.get(key);
      }

      let asset;
      const baseScale = d.scale * BIOME_SCENE_SCALE;
      if (mode === "rivers_mountains" || isLearnMountains) {
        if (d.type === "mountain" || d.type === "mountain_range") {
          const regionColor = getRegionSurfaceColor(d.region || "Unknown");
          asset = createMountainFeature(
            globeTheme,
            isSelected,
            d.isFound,
            d.bearing,
            d.spread,
            d.height,
            d.path,
            d.lat,
            d.lng,
            baseScale * RELIEF.mountainScale,
            regionColor,
          );
        } else {
          asset = new THREE.Group();
        }
      } else {
        asset = new THREE.Group();
      }

      const alignedAsset = new THREE.Group();
      asset.rotation.x = BIOME_SURFACE_ALIGNMENT_RADIANS;
      alignedAsset.add(asset);
      alignedAsset.scale.setScalar(baseScale * RELIEF.mountainScale);

      biomeObjectsCacheRef.current.set(key, alignedAsset);
      return alignedAsset;
    },
    [theme, globeTheme, mode, selectedCountry, isLearnMountains, getRegionSurfaceColor],
  );

  useEffect(() => {
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
    lerpColor,
  ]);

  const getSelectionEffectAltitude = useCallback(() => {
    if (selectedCountry) return 0.0075;
    return 0.0015;
  }, [selectedCountry]);

  const getHtmlAltitude = useCallback(
    (d) => {
      if (selectedCountry && d.admin === selectedCountry) return 0.0085;
      return 0.002;
    },
    [selectedCountry],
  );

  const countrySizes = useMemo(() => {
    const sizes = {};
    selectableFeatureIndex.forEach((entry) => {
      const b = entry.bounds;
      sizes[entry.admin] = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat);
    });
    return sizes;
  }, [selectableFeatureIndex]);

  const getPolygonCurvatureResolutionWrapped = useCallback(
    (d) => getPolygonCurvatureResolution(d, countrySizes),
    [getPolygonCurvatureResolution, countrySizes]
  );

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

        const isPlayMode = mode !== "learn" && !isHomeScreen && !isEndScreen;
        if (isPlayMode && !isFound && !isSelected) {
          return null;
        }

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

        const isLearnMode = mode === "learn";
        const labelRadius = isLearnMode
          ? 85
          : isDepartmentMode
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
        if (mode === "learn") {
          return a.admin.localeCompare(b.admin);
        }
        return a.distToCenter - b.distToCenter;
      });

    if (isDepartmentMode)
      return filtered.slice(0, perfProfile?.isMobile ? 10 : 18);
    if (mode === "learn") {
      const limit = perfProfile?.isMobile ? 120 : 180;
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
    globeEl,
  ]);

  const createLabelElement = useCallback(
    (d) => {
      return createGlobeLabelElement(d, {
        REGION_COLORS_LABELS,
        UI_COLORS,
        isHomeScreen,
        isEndScreen,
        isLight,
        gameDataMap,
        globeTheme,
        mode,
        t,
      });
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
    ],
  );

  const activeAtmosphereColor = useMemo(() => {
    return getOpaqueThreeColor(UI_COLORS.atmosphere);
  }, [UI_COLORS.atmosphere]);

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

  const countriesWithGeometry = useMemo(() => {
    return new Set(renderCountriesData.map(getFeatureAdmin));
  }, [renderCountriesData]);

  const markersData = useMemo(() => {
    if (isDepartmentMode || isRiversMountainsMode) return [];

    return Object.entries(countryDataMap)
      .filter(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return false;
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
      if (selectedCountry && d.admin === selectedCountry) return 0.01;
      return 0.0015;
    },
    [selectedCountry],
  );

  const getRingColor = useCallback(
    (d) => d.color || UI_COLORS.accentSoft,
    [UI_COLORS],
  );

  const getPointColorWrapped = useCallback(
    (d) => getOpaqueThreeColor(getPointColor(d)),
    [getPointColor],
  );
  const getRingColorWrapped = useCallback(
    (d) => getOpaqueThreeColor(getRingColor(d)),
    [getRingColor],
  );
  const getLatWrapped = useCallback((d) => d.lat, []);
  const getLngWrapped = useCallback((d) => d.lng, []);
  const getRingMaxRadiusWrapped = useCallback((d) => d.maxRadius, []);
  const getRingSpeedWrapped = useCallback((d) => d.speed, []);
  const getRingRepeatWrapped = useCallback((d) => d.repeat, []);
  const getObjectRotationWrapped = useCallback((d) => ({ z: d.rotation }), []);

  const handleGlobeReady = () => {
    updateGlobeLighting();
    styleGlobeGraticules();
  };

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
          polygonCapCurvatureResolution={getPolygonCurvatureResolutionWrapped}
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
