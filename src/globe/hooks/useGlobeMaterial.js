import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { attribute } from "three/tsl";

import { getThemeColors, GLOBE_FX_DEFAULTS } from "../../config/designSystem";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getCapitalLightsTexture } from "../render/capitalLightsTexture";
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
        ${shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
        )}
  `;
  shader.fragmentShader = `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
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

    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      // Minimalist monochrome pixel-wave / ASCII wavelet ocean shader
      // Latitude-compensated spherical cell grid (~7.5 CSS px cells at default zoom,
      // subdivided into a crisp 5x5 pixel-art bitmap for ~, -, and · wavelets)
      vec3 sphereDir = normalize(vWorldNormal);
      float rawLat = asin(clamp(sphereDir.y, -1.0, 1.0));
      float rawLng = atan(sphereDir.z, sphereDir.x);
      float latNorm = rawLat / 3.14159265 + 0.5;
      float camAlt = max(length(cameraPosition) - 100.0, 15.0);
      float zoomOctave = exp2(floor(log2(clamp(230.0 / camAlt, 1.0, 8.0)) + 0.5));
      float resLat = 48.0 * zoomOctave;

      float cellRow = floor(rawLat * resLat);
      float rowLat = (cellRow + 0.5) / resLat;
      float colsPerRad = max(floor(resLat * cos(rowLat) * 1.15 + 0.5), 8.0);
      float cellCol = floor(rawLng * colsPerRad);

      // Integer sub-pixel coordinates [0..4] inside each 5x5 pixel-art cell
      vec2 cellUv = vec2(fract(rawLng * colsPerRad), fract(rawLat * resLat));
      vec2 subPx = floor(cellUv * 5.0);
      float sx = subPx.x;
      float sy = subPx.y;

      vec2 cellId = vec2(cellCol, cellRow);
      float cellHash = oceanCellHash(cellId);

      // Gentle ocean swell & slow horizontal wavelet drift
      vec2 qSphere = vec2((cellCol + 0.5) / colsPerRad, rowLat);
      float swellA = sin(qSphere.x * 11.0 + uTime * 0.65 + sin(qSphere.y * 6.0) * 1.4) *
                     cos(qSphere.y * 9.0 - uTime * 0.32);
      float swellB = cos(qSphere.x * 17.0 - uTime * 0.48 + qSphere.y * 5.0);
      float swell = swellA * 0.65 + swellB * 0.35;

      // Sparse minimalist presence (~24% of cells carry a tiny wavelet or dot; 76% empty ocean)
      float waveActive = step(-0.08, swell) * step(0.62, cellHash);

      // Animated 1-pixel vertical bob on the tilde crest so wavelets ripple gently in place
      float bob = step(0.0, sin(uTime * 1.9 + cellHash * 6.2831853 + qSphere.x * 12.0));

      // Crisp 5x5 pixel-art bitmap glyphs:
      // 1) Tilde wave (~): 4-pixel horizontal ripple across columns 0..3
      float tildeY = (sx < 0.5) ? 2.0 : ((sx < 1.5) ? (2.0 + bob) : ((sx < 2.5) ? 2.0 : (2.0 - (1.0 - bob))));
      float isTilde = step(sx, 3.5) * (1.0 - step(0.5, abs(sy - tildeY)));

      // 2) Short ripple dash (-): 3-pixel horizontal bar at columns 1..3, row 2
      float isDash = step(0.5, sx) * step(sx, 3.5) * (1.0 - step(0.5, abs(sy - 2.0)));

      // 3) Single pixel sea-foam dot (·): center pixel (2, 2)
      float isDot = (1.0 - step(0.5, abs(sx - 2.0))) * (1.0 - step(0.5, abs(sy - 2.0)));

      float glyphType = fract(cellHash * 19.7);
      float glyph = (glyphType < 0.50) ? isTilde : ((glyphType < 0.80) ? isDash : isDot);

      // Subtle breathing modulation per wavelet
      float breath = 0.68 + 0.32 * sin(uTime * 1.4 + cellHash * 6.2831853);
      float wavePixel = waveActive * glyph * breath;

      // Delicate dithered horizon limb (only near the outer silhouette of the globe)
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float viewIncidence = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);
      vec2 globalSubPx = cellId * 5.0 + subPx;
      float bayer = bayer4x4(globalSubPx);
      float limb = pow(clamp(1.0 - viewIncidence, 0.0, 1.0), 2.2);
      float limbBit = step(bayer + 0.12, limb * 0.52) * 0.09;

      // Monochrome pixel-wavelet luminance (~0.21 on lit wavelet pixels above dark sea base,
      // crisp and readable as tiny pixel waves while keeping 96% of ocean pixels deep black)
      float pixelAlpha = wavePixel * (0.145 + uRimStrength * 0.34) + limbBit;
      vec3 waveRgb = mix(vec3(0.78, 0.82, 0.86), uRimColor, 0.45) * pixelAlpha;

      // Fine dithered Equator and Tropics reference lines
      float latWidth = max(fwidth(latNorm), 0.00045);
      float eqLine = clamp(1.0 - abs(latNorm - 0.5) / latWidth, 0.0, 1.0);
      float tropicLine = clamp(1.0 - abs(abs(latNorm - 0.5) - 23.44 / 180.0) / latWidth, 0.0, 1.0);
      float specialLines = max(eqLine, tropicLine);
      float specialDither = step(bayer + 0.05, specialLines * 0.55) * 0.06;
      vec3 graticuleColor = mix(vec3(0.55, 0.65, 0.75), uRimColor, 0.45);
      vec3 graticuleRgb = graticuleColor * (specialDither * (0.07 + uRimStrength * 0.28));

      gl_FragColor.rgb += waveRgb + graticuleRgb;
      `
    )}
  `;
};

const applySatelliteSensorShader = (shader, gridUvExpr = "vMapUv") => {
  shader.uniforms.uTime = polygonGlitchUniforms.uTime;
  shader.uniforms.uShowcaseLights = polygonGlitchUniforms.uShowcaseLights;
  shader.uniforms.uIsRegionalMode = polygonGlitchUniforms.uIsRegionalMode;
  shader.uniforms.uCapitalLightsMap = { value: getCapitalLightsTexture() };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vSatWorldPos;")
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvSatWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
      varying vec3 vSatWorldPos;
      uniform float uTime;
      uniform float uShowcaseLights;
      uniform float uIsRegionalMode;
      uniform sampler2D uCapitalLightsMap;`
    )
    .replace(
      "#include <map_fragment>",
      `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
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

        vec3 satSphereDir = normalize(vSatWorldPos);
        vec2 satCartUv = vec2(
          atan(satSphereDir.x, satSphereDir.z) / 6.2831853 + 0.5,
          asin(clamp(satSphereDir.y, -1.0, 1.0)) / 3.14159265 + 0.5
        );
        vec4 satTopo = texture2D(uCapitalLightsMap, satCartUv);
        float satCity = satTopo.r * isLand;
        float satRawAura = satTopo.g * isLand;
        float satRelief = satTopo.b * isLand;
        float satRiver = satTopo.a * isLand;
        float satRegPin = step(0.975, satRawAura);
        float satAura = (satRegPin > 0.5 && satCity < 0.25) ? 0.0 : satRawAura;
        float satPower = clamp(uShowcaseLights * (1.0 - uIsRegionalMode), 0.0, 1.0) * isLand;
        float satSleep = clamp((1.0 - uShowcaseLights) * (1.0 - uIsRegionalMode), 0.0, 1.0) * isLand;
        sampledDiffuseColor.rgb *= mix(1.0, 0.76, satSleep);

        float satCrest = step(0.76, satRelief);
        float satSpur = (1.0 - satCrest) * step(0.38, satRelief);
        sampledDiffuseColor.rgb = mix(
          sampledDiffuseColor.rgb,
          vec3(0.92, 0.78, 0.48),
          satCrest * mix(0.18 * isLand, 0.52, satPower) + satSpur * mix(0.08 * isLand, 0.28, satPower)
        );

        float satRiverCore = step(0.65, satRiver);
        float satRiverShim = 0.78 + 0.22 * sin(uTime * 2.2 + satCartUv.x * 140.0 + satCartUv.y * 90.0);
        vec3 satRiverCol = mix(
          vec3(0.07, 0.20, 0.30),
          mix(vec3(0.14, 0.48, 0.62), vec3(0.42, 0.86, 0.94), satRiverShim),
          satPower
        );
        sampledDiffuseColor.rgb = mix(
          sampledDiffuseColor.rgb,
          satRiverCol,
          satRiverCore * mix(0.46 * isLand, 0.86, satPower)
        );

        diffuseColor *= sampledDiffuseColor;
      #endif
      `
    )
    .replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      #ifdef USE_MAP
        vec2 satCellId = floor(satCartUv * vec2(3600.0, 1800.0));
        float satHash = fract(sin(dot(satCellId, vec2(127.1, 311.7))) * 43758.5453);
        float satHash2 = fract(sin(dot(satCellId + vec2(37.2, 91.7), vec2(127.1, 311.7))) * 43758.5453);
        float satWave = 0.80 + 0.20 * sin(uTime * 2.8 - satAura * 8.5 + satHash * 6.2831853);
        float satTwink = 0.78 + 0.22 * sin(uTime * 4.2 + satHash2 * 6.2831853);
        float sPin = step(0.82, satCity);
        float sArt = (1.0 - sPin) * step(0.55, satCity);
        float sTent = (1.0 - max(sPin, sArt)) * step(0.25, satCity);
        vec3 sSparkCol = sPin * vec3(1.0, 0.97, 0.84)
          + sArt * mix(vec3(0.98, 0.72, 0.18), vec3(1.0, 0.84, 0.34), satHash2)
          + sTent * vec3(0.94, 0.54, 0.16);
        float sSparkAlpha = (
          sPin * 0.98 +
          sArt * (0.78 + 0.16 * satHash2) * satWave +
          sTent * (0.50 + 0.24 * satHash2) * satTwink
        ) * satPower;
        gl_FragColor.rgb = mix(
          gl_FragColor.rgb,
          max(gl_FragColor.rgb, vec3(0.68, 0.40, 0.12)),
          satAura * 0.30 * satPower
        );
        gl_FragColor.rgb = mix(
          gl_FragColor.rgb,
          max(gl_FragColor.rgb, satRiverCol),
          satRiverCore * 0.55 * satPower
        );
        gl_FragColor.rgb = mix(gl_FragColor.rgb, sSparkCol, clamp(sSparkAlpha, 0.0, 1.0));
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
