import { useEffect } from "react";
import * as THREE from "three";

import { runInIdleSlices } from "../render/idleQueue";

// Delay after the first question appears: let the card/HUD settle first.
const WARMUP_DELAY_MS = 1200;
const RETRY_DELAY_MS = 1000;
const MAX_ATTEMPTS = 10;

// Probes kept alive: three.js frees a program as soon as its last material is
// disposed, and the real "success" materials must hit the program cache.
const retainedProbes = new Map();

function opaqueVariant(source, toneMapped) {
  const probe = source.clone();
  // Material.copy() does not carry the shader hooks: reuse them so the probe
  // resolves to the exact same program as the real success material.
  probe.onBeforeCompile = source.onBeforeCompile;
  probe.customProgramCacheKey = source.customProgramCacheKey;
  if (source.userData?.shader) probe.userData.shader = source.userData.shader;
  probe.transparent = false;
  probe.toneMapped = toneMapped;
  probe.opacity = 1;
  return probe;
}

/**
 * The first correct answer used to freeze the game for 0.6-0.8 s: the
 * selected country's "success" variant (opaque glitch cap/side) had no GPU
 * program yet and three.js linked it synchronously mid-animation.
 *
 * During a game, before the first answer, compile an opaque copy of every
 * selection-shader material currently on the globe (same geometry, same
 * program key) while the browser is idle. Rendering is unchanged: probes are
 * never added to the scene.
 */
export function precompileFoundPrograms(globe) {
  const renderer = globe?.renderer?.();
  const scene = globe?.scene?.();
  const camera = globe?.camera?.();
  if (!renderer || !scene || !camera) return 0;
  const probes = [];
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    // three-globe polygons carry [side, cap] material arrays.
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => {
      if (!material?.userData?.isGlitchShaderCap) return;
      // Success = opaque; tone mapping differs between the cap and side passes.
      [true, false].forEach((toneMapped) => {
        const key = `${material.isNodeMaterial ? "gpu" : "gl"}-${material.customProgramCacheKey?.() ?? material.type}-${toneMapped}`;
        if (retainedProbes.has(key)) return;
        const mesh = new THREE.Mesh(obj.geometry, opaqueVariant(material, toneMapped));
        mesh.matrixWorld.copy(obj.matrixWorld);
        retainedProbes.set(key, mesh);
        probes.push(mesh);
      });
    });
  });
  probes.forEach((probe) => {
    try {
      if (renderer.isWebGPURenderer)
        renderer.compileAsync?.(probe, camera, scene)?.catch?.(() => {});
      else renderer.compile(probe, camera, scene);
    } catch {
      // Warm-up is best effort only.
    }
  });
  return probes.length;
}

function linkProbePrograms(renderer) {
  if (!renderer || renderer.isWebGPURenderer) return;
  retainedProbes.forEach((probe) => {
    try {
      const program = renderer.properties?.get?.(probe.material)?.currentProgram;
      if (program && (typeof program.isReady !== "function" || program.isReady())) {
        program.getUniforms();
      }
    } catch {
      // Best effort.
    }
  });
}

export function useFoundProgramWarmup(globeEl, { active }) {
  useEffect(() => {
    if (!active) return undefined;
    let cancel = () => {};
    let attempts = 0;
    // globe.gl applies the selection material on a debounced digest: retry
    // until the selected country's shader material is on the globe.
    const run = () => {
      cancel = runInIdleSlices(
        [
          () => {
            attempts += 1;
            const found = precompileFoundPrograms(globeEl?.current) > 0;

            if (!found && retainedProbes.size === 0 && attempts < MAX_ATTEMPTS) run();
          },
          () => linkProbePrograms(globeEl?.current?.renderer?.()),
        ],
        { startDelayMs: attempts === 0 ? WARMUP_DELAY_MS : RETRY_DELAY_MS }
      );
    };
    run();
    return () => cancel();
  }, [active, globeEl]);
}
