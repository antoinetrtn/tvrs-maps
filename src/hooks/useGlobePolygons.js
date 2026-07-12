import { useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { countryDataMap } from "../data/gameData";
import {
  GLOBE_STYLE,
  getOpaqueThreeColor,
  getThemeColors,
  getThemeRegionColor,
  getThemeRegionColorAttenuated,
  getThemeRegionColorLabel,
  getThemeDepartmentColor,
} from "../config/designSystem";
import {
  getPolygonAltitudeFor,
  GAME_REGIONS,
} from "../config/gameConfig";
import {
  GLITCH_VERTEX_DECLARATIONS,
  GLITCH_VERTEX_BODY,
  GLITCH_FRAGMENT_DECLARATIONS,
  GLITCH_FRAGMENT_BODY,
} from "../config/globeShaders";
import {
  getFeaturePolygons,
  getLngLatBounds,
  getFeatureAdmin,
} from "../utils/utils";

const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
const _lerpColor1 = new THREE.Color();
const _lerpColor2 = new THREE.Color();

export function useGlobePolygons({
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
}) {
  const polygonMaterialCacheRef = useRef({ cap: new Map(), side: new Map() });
  const sharedMaterialsRef = useRef(new Map());

  const safeColor = useCallback((c) => getOpaqueThreeColor(c), []);

  const lerpColor = useCallback(
    (a, b, amount) => {
      try {
        const colorA = safeColor(a);
        const colorB = safeColor(b);
        _lerpColor1.set(colorA);
        _lerpColor2.set(colorB);
        _lerpColor1.lerp(_lerpColor2, Math.max(0, Math.min(1, amount)));
        return `#${_lerpColor1.getHexString()}`;
      } catch (e) {
        return safeColor(a);
      }
    },
    [safeColor],
  );

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

      if (isEndScreen) {
        if (foundSet.has(admin)) {
          return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        }
        return UI_COLORS.error;
      }

      if (foundSet.has(admin) || mode === "learn") {
        const isSatellite = globeTheme === "satellite";
        const baseColor = isSatellite
          ? (REGION_COLORS_LABELS[region] || UI_COLORS.accent)
          : getRegionSurfaceColor(region);
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
      REGION_COLORS_LABELS,
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
      lerpColor,
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
      const data = countryDataMap[admin];
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
    [foundSet, mode, getRegionSurfaceColor, UI_COLORS, isLight, lerpColor, isEndScreen, isPerfectScore]
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
          specularHex = new THREE.Color(0, 0, 0);
          shininess = 0.0;
        } else {
          emissiveHex = color;
          emissiveIntensity = isLight
            ? (Number(UI_COLORS.polyMatEmissiveIntensityFoundLight) || 0.22)
            : (Number(UI_COLORS.polyMatEmissiveIntensityFoundDark) || 0.52);
          specularHex = new THREE.Color(0, 0, 0);
          shininess = 0.0;
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
      const isPrevTransitioning = admin === transitioningPreviousCountryState;
      const isShaderCap =
        (kind === "cap" || kind === "side") &&
        (isIsolated || isPrevTransitioning || (isEndScreen && !foundSet.has(admin)));
      const isMobileStr = perfProfile?.isMobile ? "mobile" : "desktop";

      const cacheKey = isShaderCap
        ? `shader-${admin}-${kind}-${isMobileStr}-${globeTheme}`
        : `${kind}-${color}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}-${globeTheme}`;

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

        const isSatellite = globeTheme === "satellite";
        if (isSatellite) {
          material.transparent = true;
          if (admin === selectedCountry) {
            material.wireframe = false;
          } else if (isFound) {
            material.wireframe = true;
          } else {
            if (kind === "cap") {
              material.opacity = 0.0;
            } else {
              material.visible = false;
            }
          }
        }
        if (isShaderCap) {
          if (kind === "side") {
            material.transparent = true;
            material.opacity = 0.55;
          }
          material.customProgramCacheKey = () => `shader-cap-glitch-${kind}`;
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
            shader.uniforms.uIsFound = {
              value: isFound ? 1.0 : 0.0,
            };
            material.userData.shader = shader;

            shader.vertexShader = GLITCH_VERTEX_DECLARATIONS + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
              `#include <begin_vertex>`,
              `#include <begin_vertex>
              ${GLITCH_VERTEX_BODY}
            `
            );

            shader.fragmentShader = GLITCH_FRAGMENT_DECLARATIONS + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
              `#include <dithering_fragment>`,
              GLITCH_FRAGMENT_BODY
            );
          };
        }

        material.userData.isIsolated = isIsolated;
        material.userData.isShared = !isIsolated;
        material.userData.admin = admin;

        sharedMaterialsRef.current.set(cacheKey, material);
      }

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
      transitioningPreviousCountryState,
      getBaseColorForCountryAndKind,
      safeColor,
      isError,
      isSuccess,
      isEndScreen,
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
      return getPolygonAltitudeFor({
        isDepartmentMode,
        isGhostCountry: !!(isDepartmentMode && d.isGhostCountry),
        isSelected,
      });
    },
    [isDepartmentMode, selectedCountry],
  );

  const getPolygonStrokeWidth = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;
      if (isDepartmentMode && d.isGhostCountry) {
        return perfProfile?.isMobile ? 0.1 : 0.15;
      }
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
    GAME_REGIONS.forEach((region) => {
      // Stub or construct dynamically depending on selectable feature bounds.
      // We will compute sizes in the components or pass it as calculated.
    });
    return sizes;
  }, []);

  const getPolygonCurvatureResolution = useCallback(
    (d, customSizes) => {
      const admin = getFeatureAdmin(d) || "unknown";
      const baseRes = perfProfile?.polygonCapCurvatureResolution ?? 1.5;
      const size = customSizes ? customSizes[admin] : undefined;
      if (size === undefined) return baseRes;

      if (size < 4) {
        return baseRes * 2.2;
      }
      if (size > 15) {
        return baseRes * 0.3;
      }
      if (size >= 8) {
        return baseRes * 0.45;
      }
      return baseRes;
    },
    [perfProfile?.polygonCapCurvatureResolution],
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

  return {
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
    getPolygonStroke,
  };
}
