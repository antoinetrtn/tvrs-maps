import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { RELIEF } from "../../config/gameConfig";
import { riversMountainsDataMap } from "../../data/riversMountainsData";
import { runInIdleSlices } from "../render/idleQueue";
import { createMountainFeature } from "../render/LowPolyBiomes";
import { isSameAdmin } from "../render/polygonColorResolver";

const BIOME_PREWARM_DELAY_MS = 2500;

const BIOME_SCENE_SCALE = 9.2;
const BIOME_SURFACE_ALIGNMENT_RADIANS = Math.PI / 2;

let retainedLineProbes = [];

/**
 * Issues the shader program compile for the (already built) range objects
 * while the browser is idle. With KHR_parallel_shader_compile this does not
 * block; in all cases the one-off link no longer lands on the card swipe.
 */
function precompileBiomePrograms(globeEl, objects) {
  const globe = globeEl?.current;
  const renderer = globe?.renderer?.();
  const scene = globe?.scene?.();
  const camera = globe?.camera?.();
  if (!renderer || renderer.isWebGPURenderer || typeof renderer.compile !== "function") return;
  if (!scene || !camera) return;
  try {
    objects.forEach((obj) => renderer.compile(obj, camera, scene));
    if (retainedLineProbes.length > 0) return;
    // River paths (three-globe fat lines): plain + dashed ("core") programs.
    const lineProbes = [false, true].map((dashed) => {
      const geometry = new LineGeometry();
      geometry.setPositions([0, 0, 0, 0, 0, 1]);
      const material = new LineMaterial();
      if (dashed) {
        material.dashed = true;
        material.defines.USE_DASH = "";
      }
      return new Line2(geometry, material);
    });
    lineProbes.forEach((probe) => renderer.compile(probe, camera, scene));
    // Keep the probes alive: three.js frees a program as soon as its last
    // material is disposed, and the real river lines must hit the cache.
    retainedLineProbes = lineProbes;
  } catch {
    // Warm-up is best effort only.
  }
}

/**
 * compile() only submits the link: three.js still waits for it (and reads the
 * uniform table) at the program's FIRST DRAW, i.e. mid-swipe. Touching the
 * uniforms here, one program per idle slice, moves that wait out of the
 * gesture. Idempotent: the table is memoized by three.js.
 */
function linkProgramsInIdle(globeEl) {
  const renderer = globeEl?.current?.renderer?.();
  if (!renderer || renderer.isWebGPURenderer || !renderer.info?.programs) return () => {};
  const tasks = [...renderer.info.programs].map((program) => () => {
    try {
      if (typeof program.isReady !== "function" || program.isReady()) program.getUniforms();
    } catch {
      // Best effort.
    }
  });
  return runInIdleSlices(tasks, { startDelayMs: 600 });
}

export function useGlobeBiomes({
  globeEl = null,
  mode,
  isRiversMountainsMode,
  gameDataMap,
  selectedCountry,
  foundSet,
  isHomeScreen,
}) {
  const biomeObjectsCacheRef = useRef(new Map());

  const getBiomeAssetsData = useMemo(() => {
    if (!isRiversMountainsMode) return [];
    const assets = [];
    const dataMap = gameDataMap;

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
      const isFound = foundSet.has(k) || mode === "learn";
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
  }, [gameDataMap, foundSet, isRiversMountainsMode]);

  const getBiomeAltitude = useCallback(
    (d) => {
      const admin = d.admin;
      const isSelected = isSameAdmin(admin, selectedCountry, gameDataMap);
      if (isRiversMountainsMode) {
        return isSelected ? 0.003 : 0.0015;
      }
      return isSelected ? 0.0025 : 0.0015;
    },
    [selectedCountry, isRiversMountainsMode, gameDataMap]
  );

  const getOrBuildBiome = useCallback((d, isSelected) => {
    const key = `${d.admin || "unknown"}_${d.isFound ? "found" : "unfound"}_selected_${isSelected}_${d.scale}_${d.lat}_${d.lng}`;
    const cached = biomeObjectsCacheRef.current.get(key);
    if (cached) return cached;

    let asset;
    const baseScale = d.scale * BIOME_SCENE_SCALE;
    if (d.type === "mountain" || d.type === "mountain_range") {
      asset = createMountainFeature(
        isSelected,
        d.isFound,
        d.bearing,
        d.spread,
        d.height,
        d.path,
        d.lat,
        d.lng,
        baseScale * RELIEF.mountainScale,
        GLITCH_EFFECT_SETTINGS.foundMountainColor
      );
    } else {
      asset = new THREE.Group();
    }

    const alignedAsset = new THREE.Group();
    asset.rotation.x = BIOME_SURFACE_ALIGNMENT_RADIANS;
    alignedAsset.add(asset);
    alignedAsset.scale.setScalar(baseScale * RELIEF.mountainScale);

    biomeObjectsCacheRef.current.set(key, alignedAsset);
    return alignedAsset;
  }, []);

  const createBiomeThreeObject = useCallback(
    (d) => getOrBuildBiome(d, isSameAdmin(d.admin, selectedCountry, gameDataMap)),
    [getOrBuildBiome, selectedCountry, gameDataMap]
  );

  // Build the neutral (unselected, unfound) range objects once the browser is
  // idle, a few at a time, so opening the Mountains & Rivers card only has to
  // add already-built objects to the scene instead of generating ~50 ranges
  // inside a single frame.
  useEffect(() => {
    if (!isRiversMountainsMode && !isHomeScreen) return undefined;
    const ranges = Object.keys(riversMountainsDataMap)
      .map((k) => ({ k, data: riversMountainsDataMap[k] }))
      .filter(
        ({ data }) =>
          data &&
          (data.type === "mountain" || data.type === "mountain_range") &&
          data.lat !== undefined &&
          data.lng !== undefined
      );
    const toAsset = (k, data) => ({
      admin: k,
      lat: data.lat,
      lng: data.lng,
      isFound: false,
      type: data.type,
      bearing: data.bearing || 0,
      spread: data.spread || 1.5,
      height: data.height || 4000,
      scale: data.type === "mountain_range" ? 1.55 : 1.0,
      path: data.path || null,
    });
    const tasks = ranges.map(
      ({ k, data }) =>
        () =>
          getOrBuildBiome(toAsset(k, data), false)
    );
    // Then link the shader programs (neutral + selected "glitch" variants) so the
    // first render of the card has nothing left to compile.
    const [first] = ranges;
    tasks.push(() => {
      if (!first) return;
      const asset = toAsset(first.k, first.data);
      precompileBiomePrograms(globeEl, [
        getOrBuildBiome(asset, false),
        getOrBuildBiome(asset, true),
      ]);
    });
    let cancelLink = () => {};
    const cancelBuild = runInIdleSlices(tasks, {
      startDelayMs: BIOME_PREWARM_DELAY_MS,
      onDone: () => {
        cancelLink = linkProgramsInIdle(globeEl);
      },
    });
    return () => {
      cancelBuild();
      cancelLink();
    };
  }, [getOrBuildBiome, globeEl, isRiversMountainsMode, isHomeScreen]);

  useEffect(() => {
    const cache = biomeObjectsCacheRef.current;
    return () => {
      cache.forEach((obj) =>
        obj.traverse((child) => {
          if (child.geometry?.userData?.mergedPeaks) child.geometry.dispose();
        })
      );
      cache.clear();
    };
  }, []);

  return {
    getBiomeAssetsData,
    getBiomeAltitude,
    createBiomeThreeObject,
  };
}
