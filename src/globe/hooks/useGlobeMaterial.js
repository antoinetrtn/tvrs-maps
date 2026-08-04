import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { getThemeColors } from "../../config/designSystem";
import { useAppTheme } from "../../hooks/useAppTheme";

const applyBlackoutOceanShader = (shader) => {
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

    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      // 1. Grille géographique haute fréquence identique au mode satellite (crée le moirage de diffraction)
      vec2 gridUv = vUv * vec2(16384.0, 8192.0);
      vec2 gridFract = abs(fract(gridUv - 0.5) - 0.5);
      float gridLine = smoothstep(0.0, 0.08, min(gridFract.x, gridFract.y));

      // 2. Bruit de capteur par bloc
      vec2 blockId = floor(gridUv);
      float noise = fract(sin(dot(blockId, vec2(12.9898, 78.233))) * 43758.5453);

      // 3. Éclairage neutre monochrome & réactivité à la rotation
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float viewIncidence = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);
      float lightFacing = max(0.0, dot(vWorldNormal, normalize(vec3(1.0, 1.5, 2.0))));
      float rimLight = pow(1.0 - viewIncidence, 3.5);

      // Superposition du moirage de grille très adouci + bruit neutre + halo gris acier
      vec3 moireGrid = vec3(0.88, 0.92, 0.96) * (1.0 - gridLine) * 0.055 * (0.6 + 0.5 * lightFacing);
      vec3 sensorNoise = vec3((noise - 0.5) * 0.025);
      vec3 neutralRim = vec3(0.85, 0.88, 0.92) * rimLight * 0.07;

      gl_FragColor.rgb += moireGrid + sensorNoise + neutralRim;
      `
    )}
  `;
};

const applySatelliteSensorShader = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D( map, vMapUv );
      
      vec2 gridUv = vMapUv * vec2(16384.0, 8192.0);
      vec2 gridFract = abs(fract(gridUv - 0.5) - 0.5);
      float gridLine = smoothstep(0.0, 0.08, min(gridFract.x, gridFract.y));
      
      vec3 gridColor = vec3(0.0, 0.5, 0.95);
      sampledDiffuseColor.rgb = mix(gridColor, sampledDiffuseColor.rgb, 0.94 + 0.06 * gridLine);
      
      vec2 blockId = floor(gridUv);
      float noise = fract(sin(dot(blockId, vec2(12.9898, 78.233))) * 43758.5453);
      
      float isLand = step(0.18, length(sampledDiffuseColor.rg - sampledDiffuseColor.b));
      sampledDiffuseColor.rgb += (noise - 0.5) * 0.03 * isLand;
      
      diffuseColor *= sampledDiffuseColor;
    #endif
    `
  );
};

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
    if (typeof window !== "undefined" && window.__TVRS_GLOBE_EL__?.renderer?.()) {
      const maxAnisotropy =
        window.__TVRS_GLOBE_EL__.renderer().capabilities?.getMaxAnisotropy() || 8;
      texture.anisotropy = Math.min(16, maxAnisotropy);
    }
    return texture;
  }, [UI_COLORS?.globeTextureUrl]);

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
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness: 0.88,
        metalness: 0.05,
      });
      mat.onBeforeCompile = applyBlackoutOceanShader;
      return mat;
    }

    if (UI_COLORS.globeTextureUrl) {
      const mat = new THREE.MeshStandardMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.0,
      });
      mat.onBeforeCompile = applySatelliteSensorShader;
      return mat;
    }

    return new THREE.MeshPhongMaterial({
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

  useEffect(() => {
    return () => {
      globeMaterial.dispose();
    };
  }, [globeMaterial]);

  return globeMaterial;
}
