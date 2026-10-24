import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { attribute } from "three/tsl";

import { getThemeColors, GLOBE_FX_DEFAULTS } from "../../config/designSystem";
import { useAppTheme } from "../../hooks/useAppTheme";
import { GLSL_BAYER_4X4_FN } from "../render/globeShaders";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";
import {
  blackoutOceanOutputNode,
  createPhongMaterial,
  createStandardMaterial,
  satelliteSensorColorNode,
} from "../render/webgpu/surfaceNodes";

const applyBlackoutOceanShader = (shader) => {
  shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
  shader.uniforms.uTime = polygonGlitchUniforms.uTime;
  shader.uniforms.uGlobeMotion = polygonGlitchUniforms.uGlobeMotion;
  shader.uniforms.uGlobeVelocity = polygonGlitchUniforms.uGlobeVelocity;
  shader.vertexShader = `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;
    ${shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv = uv;
      `
    )}
  `;
  shader.fragmentShader = `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;
    uniform vec3 uRimColor;
    uniform float uRimStrength;
    uniform float uPixelScale;
    uniform float uTime;
    uniform float uGlobeMotion;
    uniform vec2 uGlobeVelocity;

    ${GLSL_BAYER_4X4_FN}

    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      float camDist = length(cameraPosition);
      float subGridVis = 1.0 - smoothstep(180.0, 260.0, camDist);

      // Zoom-adaptive fine dither grid so stipple cells stay crisp 1px particles at any zoom
      float oceanLat = (vUv.y - 0.5) * 3.14159265;
      float oceanLng = (vUv.x - 0.5) * 6.2831853;
      float gridDensity = mix(5200.0, 2200.0, clamp((camDist - 108.0) / 170.0, 0.0, 1.0));
      vec2 px = floor(vUv * vec2(gridDensity, gridDensity * 0.5));
      float bayer = bayer4x4(px);

      // Magnetic-field / ocean-gyre streamfunction reacting to globe motion & angular velocity
      vec2 velShift = uGlobeVelocity * (1.6 + uGlobeMotion * 2.4);
      float fLat = oceanLat + velShift.y * 0.35;
      float fLng = oceanLng + velShift.x * 0.35;

      float gyre1 = sin(fLng * 3.0 + sin(fLat * 4.0) * 0.65) * cos(fLat * 2.5);
      float gyre2 = cos(fLng * 5.0 - fLat * 3.0 + sin(fLng * 2.0) * 0.5) * 0.55;
      float streamPsi = fLat * 3.8 + gyre1 * 0.95 + gyre2 * 0.65;

      // Crisp magnetic flux lines + travelling current dashes along the streamlines
      float fluxWave = 0.5 + 0.5 * cos(streamPsi * 18.0);
      float fluxLine = pow(fluxWave, 3.2);
      float dashPhase = fLng * 36.0 - gyre1 * 14.0 - uTime * (2.2 + uGlobeMotion * 6.5);
      float fluxDash = smoothstep(-0.15, 0.72, sin(dashPhase));
      float motionRipple = uGlobeMotion * (0.4 + 0.6 * sin(streamPsi * 26.0 - uTime * 8.0));

      float magneticCurrent = fluxLine * (0.38 + 0.62 * fluxDash) + motionRipple * 0.28;
      float waveDither = step(bayer, magneticCurrent * 0.72) * (0.048 + uRimStrength * 0.42 + uGlobeMotion * 0.045);

      // 1. Curvature & spherical lighting
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float viewIncidence = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);
      float lightFacing = clamp(dot(vWorldNormal, normalize(vec3(-0.55, 0.45, 0.70))), 0.0, 1.0);
      float limb = pow(1.0 - viewIncidence, 1.85);

      // Bayer 4x4 ordered-dithered tonal steps toward the horizon limb + magnetic current shimmer
      float oceanShade = limb * (0.65 + 0.35 * lightFacing) + magneticCurrent * 0.14;
      float quantizedLimb = floor(oceanShade * 5.0 + bayer) / 5.0;
      float grazingStipple = step(0.85, limb) * step(bayer, (limb - 0.85) * 6.0) * 0.08;
      vec3 ditheredRim = uRimColor * ((quantizedLimb + grazingStipple) * uRimStrength * 3.2 + waveDither);

      // 2. Cartographic graticule & micro-stipple (equirectangular vUv)
      // 15-degree lat/lon grid (24 x 12 cells around the sphere)
      vec2 gridUv15 = vUv * vec2(24.0, 12.0);
      vec2 gridPx15 = max(fwidth(gridUv15), vec2(0.0008));
      vec2 lineDist15 = abs(fract(gridUv15 + 0.5) - 0.5) / gridPx15;
      float line15 = clamp(1.0 - min(lineDist15.x, lineDist15.y), 0.0, 1.0);
      float gridDither = step(bayer * 0.75 + 0.1, line15);

      // Major 30-degree accents
      vec2 gridUv30 = vUv * vec2(12.0, 6.0);
      vec2 gridPx30 = max(fwidth(gridUv30), vec2(0.0008));
      vec2 lineDist30 = abs(fract(gridUv30 + 0.5) - 0.5) / gridPx30;
      float line30 = clamp(1.0 - min(lineDist30.x, lineDist30.y), 0.0, 1.0);
      gridDither = max(gridDither, step(bayer * 0.55, line30));

      // Subtle 5-degree subgrid ticks at intersections (72 x 36 cells)
      vec2 subGridUv = vUv * vec2(72.0, 36.0);
      vec2 subDist = abs(fract(subGridUv + 0.5) - 0.5) / max(fwidth(subGridUv), vec2(0.001));
      float subTick = clamp(1.0 - max(subDist.x, subDist.y) * 0.5, 0.0, 1.0) * step(min(subDist.x, subDist.y), 0.8);
      float tickDither = step(bayer, subTick * 0.45) * 0.035 * subGridVis;

      // Highlighted Equator (latitude 0 -> vUv.y = 0.5) and Tropics (23.44 deg)
      float latWidth = max(fwidth(vUv.y), 0.0004);
      float eqDist = abs(vUv.y - 0.5) / latWidth;
      float eqLine = clamp(1.0 - eqDist, 0.0, 1.0);
      float tropicDist = abs(abs(vUv.y - 0.5) - 23.44 / 180.0) / latWidth;
      float tropicLine = clamp(1.0 - tropicDist, 0.0, 1.0);
      float specialLines = max(eqLine, tropicLine);
      float specialDither = step(bayer, specialLines * 1.1) * 0.08;

      vec3 graticuleColor = mix(vec3(0.55, 0.65, 0.75), uRimColor, 0.45);
      vec3 graticuleRgb = graticuleColor * (gridDither * 0.075 + tickDither + specialDither * (0.06 + uRimStrength * 0.5));

      gl_FragColor.rgb += ditheredRim + graticuleRgb;
      `
    )}
  `;
};

const applySatelliteSensorShader = (shader, gridUvExpr = "vMapUv") => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D( map, vMapUv );
      
      // Sensor grid, anti-aliased in screen space. At world zoom a cell is far
      // smaller than a pixel: the raw grid aliased into moiré stripes. The
      // grid (and its per-cell noise) now fades in only once cells span a
      // few pixels, with 1px-wide lines whatever the zoom.
      vec2 gridUv = ${gridUvExpr} * vec2(16384.0, 8192.0);
      vec2 cellPx = max(fwidth(gridUv), vec2(1e-4));
      float gridVis = 1.0 - smoothstep(0.18, 0.4, max(cellPx.x, cellPx.y));
      vec2 gridFract = abs(fract(gridUv - 0.5) - 0.5) / cellPx;
      float gridLine = clamp(min(gridFract.x, gridFract.y), 0.0, 1.0);

      vec3 gridColor = vec3(0.0, 0.5, 0.95);
      float gridMix = (1.0 - gridLine) * 0.1 * gridVis;
      sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, gridColor, gridMix);

      vec2 blockId = floor(gridUv);
      float noise = fract(sin(dot(blockId, vec2(12.9898, 78.233))) * 43758.5453);

      float isLand = step(0.18, length(sampledDiffuseColor.rg - sampledDiffuseColor.b));
      sampledDiffuseColor.rgb += (noise - 0.5) * 0.03 * isLand * gridVis;

      diffuseColor *= sampledDiffuseColor;
    #endif
    `
  );
};

/**
 * Material for one progressive satellite tile (useSatelliteTileLayer): same
 * PBR params and sensor grid as the globe, the grid driven by the tile's
 * equirectangular `globalUv` so it stays continuous with the base texture.
 */
export function createSatelliteTileMaterial(texture) {
  const mat = createStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
  });
  if (mat.isNodeMaterial) {
    mat.colorNode = satelliteSensorColorNode(texture, attribute("globalUv", "vec2"));
    return mat;
  }
  mat.customProgramCacheKey = () => "satellite-tile";
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 globalUv;\nvarying vec2 vGlobalUv;"
      )
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvGlobalUv = globalUv;");
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec2 vGlobalUv;"
    );
    applySatelliteSensorShader(shader, "vGlobalUv");
  };
  return mat;
}

export function useGlobeMaterial(options = {}) {
  const { UI_COLORS: themeColors, isLight: isThemeLight } = useAppTheme();

  const isObjectCall =
    options && typeof options === "object" && !options.isVector3 && !options.isTexture;

  const UI_COLORS =
    (isObjectCall ? options.UI_COLORS : null) || themeColors || getThemeColors("satellite", "dark");
  const isLight = isObjectCall && options.isLight !== undefined ? options.isLight : isThemeLight;
  const globeLightingEnabled =
    isObjectCall && options.globeLightingEnabled !== undefined
      ? options.globeLightingEnabled
      : true;

  const loadedTexture = useMemo(() => {
    if (!UI_COLORS?.globeTextureUrl) return null;

    const primaryUrl = UI_COLORS.globeTextureUrl;
    const fallbackUrl = primaryUrl.includes("night")
      ? "https://unpkg.com/three-globe/example/img/earth-night.jpg"
      : "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";

    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      primaryUrl,
      (loadedTex) => {
        loadedTex.needsUpdate = true;
      },
      undefined,
      () => {
        if (primaryUrl !== fallbackUrl) {
          loader.load(fallbackUrl, (fbTex) => {
            texture.image = fbTex.image;
            texture.needsUpdate = true;
          });
        }
      }
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [UI_COLORS?.globeTextureUrl]);

  // Anisotropic filtering keeps the texture sharp near the limb (grazing
  // angles). The renderer may not exist yet when the texture is created.
  useEffect(() => {
    if (!loadedTexture) return undefined;
    let timer = null;
    const apply = () => {
      const renderer =
        typeof window === "undefined" ? null : window.__TVRS_GLOBE_EL__?.renderer?.();
      if (!renderer) {
        timer = setTimeout(apply, 200);
        return;
      }
      const max = renderer.capabilities?.getMaxAnisotropy?.() || renderer.getMaxAnisotropy?.() || 1;
      loadedTexture.anisotropy = Math.min(8, max);
      loadedTexture.needsUpdate = true;
    };
    apply();
    return () => clearTimeout(timer);
  }, [loadedTexture]);

  useEffect(() => {
    return () => {
      if (loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [loadedTexture]);

  const customGlobeTexture =
    (isObjectCall ? options.customGlobeTexture : options?.isTexture ? options : null) ||
    loadedTexture;

  const globeMaterial = useMemo(() => {
    const matType = UI_COLORS.globeMaterialType || "phong";

    if (matType === "basic") {
      const baseColor = UI_COLORS.globeMaterialColor
        ? UI_COLORS.globeMaterialColor.startsWith("#")
          ? UI_COLORS.globeMaterialColor
          : UI_COLORS[UI_COLORS.globeMaterialColor] || UI_COLORS.mapSea
        : UI_COLORS.mapSea;
      const mat = createStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness: 0.88,
        metalness: 0.05,
      });
      const rimColor = new THREE.Color(UI_COLORS.oceanRimColor || GLOBE_FX_DEFAULTS.oceanRimColor);
      const rimStrength = Number(UI_COLORS.oceanRimStrength) || 0.07;
      if (mat.isNodeMaterial)
        mat.outputNode = blackoutOceanOutputNode(
          rimColor,
          rimStrength,
          polygonGlitchUniforms.uPixelScale
        );
      else
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uRimColor = { value: rimColor };
          shader.uniforms.uRimStrength = { value: rimStrength };
          shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
          shader.uniforms.uTime = polygonGlitchUniforms.uTime;
          mat.userData.shader = shader;
          applyBlackoutOceanShader(shader);
        };
      return mat;
    }

    if (UI_COLORS.globeTextureUrl) {
      const mat = createStandardMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.0,
      });
      if (mat.isNodeMaterial) mat.colorNode = satelliteSensorColorNode(customGlobeTexture);
      else mat.onBeforeCompile = (shader) => applySatelliteSensorShader(shader);
      return mat;
    }

    return createPhongMaterial({
      color: UI_COLORS.globeMaterialColor || UI_COLORS.mapSea,
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
  }, [UI_COLORS, isLight, globeLightingEnabled, customGlobeTexture]);

  // Deselection glitch tears follow the theme (accent-derived on Monochrome).
  useEffect(() => {
    polygonGlitchUniforms.uGlitchTintA.value.set(
      UI_COLORS.glitchTintA || GLOBE_FX_DEFAULTS.glitchTintA
    );
    polygonGlitchUniforms.uGlitchTintB.value.set(
      UI_COLORS.glitchTintB || GLOBE_FX_DEFAULTS.glitchTintB
    );
  }, [UI_COLORS.glitchTintA, UI_COLORS.glitchTintB]);

  useEffect(() => {
    return () => {
      globeMaterial.dispose();
    };
  }, [globeMaterial]);

  return globeMaterial;
}
