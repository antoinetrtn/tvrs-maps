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

    float oceanCellHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float oceanValueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float n00 = oceanCellHash(i);
      float n10 = oceanCellHash(i + vec2(1.0, 0.0));
      float n01 = oceanCellHash(i + vec2(0.0, 1.0));
      float n11 = oceanCellHash(i + vec2(1.0, 1.0));
      return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
    }

    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      // 3D sphere-anchored latitude-compensated pixel-art grid (rotates with the Earth,
      // snaps by power-of-2 zoom octaves from camera altitude so pixels stay ~2.8 CSS px)
      float rawLat = (vUv.y - 0.5) * 3.14159265;
      float rawLng = (vUv.x - 0.5) * 6.2831853;
      float camAlt = max(length(cameraPosition) - 100.0, 15.0);
      float zoomOctave = exp2(floor(log2(clamp(220.0 / camAlt, 1.0, 8.0)) + 0.5));
      float resLat = 56.0 * zoomOctave;

      float pxRow = floor(rawLat * resLat);
      float rowLat = (pxRow + 0.5) / resLat;
      float colsPerRad = max(floor(resLat * cos(rowLat) + 0.5), 8.0);
      float pxCol = floor(rawLng * colsPerRad);
      vec2 spherePx = vec2(pxCol, pxRow);
      float bayer = bayer4x4(spherePx);

      // Coarse terraced bathymetric plateaus evaluated at quantized pixel center
      // (zero sinusoidal waves, zero per-pixel white noise so Bayer 4x4 tiles stay pure)
      vec2 qSphere = vec2((pxCol + 0.5) / colsPerRad, rowLat);
      float bathyMacro = oceanValueNoise(qSphere * 2.4 + vec2(1.7, 3.1));
      float bathyMid = oceanValueNoise(qSphere * 5.2 + vec2(8.3, 4.9));
      float bathymetry = bathyMacro * 0.62 + bathyMid * 0.38;

      // Stepped spherical depth/limb shading
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float viewIncidence = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);
      float limb = pow(clamp(1.0 - viewIncidence, 0.0, 1.0), 1.35);

      // Quantize into discrete Bayer 4x4 dither levels (1/16 sparse stipple in deep basins
      // up to 8/16 crisp pixel-art checkerboard on bathymetric plateaus and limb)
      float rawField = bathymetry * 0.78 + limb * 0.45 + uGlobeMotion * 0.04;
      float bayerSteps = floor(clamp(rawField * 12.0 - 0.8, 2.0, 9.0));
      float ditherTone = bayerSteps / 16.0;
      float trameBit = step(bayer + 0.01, ditherTone);

      // Crisp pixel-art dot contrast on deep ocean (clearly visible pixels, calm overall density)
      vec3 ditheredRim = uRimColor * (trameBit * (0.16 + uRimStrength * 0.68));

      // Subtle dithered Equator and Tropics reference lines
      float latWidth = max(fwidth(vUv.y), 0.0005);
      float eqLine = clamp(1.0 - abs(vUv.y - 0.5) / latWidth, 0.0, 1.0);
      float tropicLine = clamp(1.0 - abs(abs(vUv.y - 0.5) - 23.44 / 180.0) / latWidth, 0.0, 1.0);
      float specialLines = max(eqLine, tropicLine);
      float specialDither = step(bayer + 0.03, specialLines * 0.65) * 0.08;

      vec3 graticuleColor = mix(vec3(0.55, 0.65, 0.75), uRimColor, 0.45);
      vec3 graticuleRgb = graticuleColor * (specialDither * (0.08 + uRimStrength * 0.35));

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
