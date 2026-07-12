import { useMemo, useCallback, useRef, useEffect } from "react";
import * as THREE from "three";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import {
  createMountainFeature,
} from "../utils/LowPolyBiomes";
import {
  getThemeRegionColor,
} from "../config/designSystem";
import { RELIEF } from "../config/gameConfig";

const BIOME_SCENE_SCALE = 9.2;
const BIOME_SURFACE_ALIGNMENT_RADIANS = Math.PI / 2;

export function useGlobeBiomes({
  mode,
  learnToggles,
  gameDataMap,
  selectedCountry,
  foundSet,
  isHomeScreen,
  UI_COLORS,
  isLight,
  globeTheme,
  theme,
}) {
  const {
    showMountains: learnShowMountains = false,
  } = learnToggles || {};
  const isLearnMountains = mode === "learn" && learnShowMountains;

  const biomeObjectsCacheRef = useRef(new Map());

  const getBiomeAssetsData = useMemo(() => {
    if (mode !== "rivers_mountains" && !isLearnMountains) return [];
    const assets = [];
    const dataMap = isLearnMountains ? riversMountainsDataMap : gameDataMap;

    Object.keys(dataMap).forEach((k) => {
      const data = dataMap[k];
      if (
        !data ||
        (data.type !== "mountain" && data.type !== "mountain_range") ||
        data.lat === undefined ||
        data.lng === undefined
      ) {
        return;
      }
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
          const regionColor = getThemeRegionColor(globeTheme, theme, d.region || "Unknown") || UI_COLORS.success;
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
    [theme, globeTheme, mode, selectedCountry, isLearnMountains, UI_COLORS],
  );

  useEffect(() => {
    biomeObjectsCacheRef.current.clear();
  }, [globeTheme, theme]);

  return {
    getBiomeAssetsData,
    getBiomeAltitude,
    createBiomeThreeObject,
  };
}
