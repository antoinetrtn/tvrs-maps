import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { getThemeColors } from "../../config/designSystem";
import { GLSL_BAYER_4X4_FN } from "../render/globeShaders";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";
import { blackoutOceanOutputNode, createStandardMaterial } from "../render/webgpu/surfaceNodes";

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

/** Globe ocean material: flat nocturnal sea with a dithered rim and graticule. */
export function useGlobeMaterial({ UI_COLORS = getThemeColors() } = {}) {
  const globeMaterial = useMemo(() => {
    const baseColor = UI_COLORS.globeMaterialColor || UI_COLORS.mapSea;
    const mat = createStandardMaterial({
      color: new THREE.Color(baseColor),
      roughness: 0.88,
      metalness: 0.05,
    });
    const rimColor = new THREE.Color(UI_COLORS.oceanRimColor);
    const rimStrength = Number(UI_COLORS.oceanRimStrength) || 0.07;
    if (mat.isNodeMaterial) mat.outputNode = blackoutOceanOutputNode(rimColor, rimStrength);
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
  }, [UI_COLORS]);

  // Deselection glitch tears follow the globe palette.
  useEffect(() => {
    polygonGlitchUniforms.uGlitchTintA.value.set(UI_COLORS.glitchTintA);
    polygonGlitchUniforms.uGlitchTintB.value.set(UI_COLORS.glitchTintB);
  }, [UI_COLORS.glitchTintA, UI_COLORS.glitchTintB]);

  useEffect(() => {
    return () => {
      globeMaterial.dispose();
    };
  }, [globeMaterial]);

  return globeMaterial;
}
