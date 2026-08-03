import { useEffect, useMemo } from "react";
import * as THREE from "three";

export function useGlobeMaterial({ UI_COLORS, globeLightingEnabled, isLight }) {
  const customGlobeTexture = useMemo(() => {
    if (!UI_COLORS.globeTextureUrl) return null;

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
        ? UI_COLORS.globeMaterialColor.startsWith("#")
          ? UI_COLORS.globeMaterialColor
          : UI_COLORS[UI_COLORS.globeMaterialColor] || UI_COLORS.mapSea
        : UI_COLORS.mapSea;
      return new THREE.MeshBasicMaterial({
        color: baseColor,
      });
    }

    if (UI_COLORS.globeTextureUrl) {
      const mat = new THREE.MeshStandardMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.0,
      });
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          #ifdef USE_MAP
            vec4 mapTexel = texture2D( map, vMapUv );
            
            // Calculate a fine geographic sensor grid (16384 x 8192 cells)
            vec2 gridUv = vMapUv * vec2(16384.0, 8192.0);
            vec2 gridFract = abs(fract(gridUv - 0.5) - 0.5);
            // Infinitely sharp grid lines at any zoom:
            float gridLine = smoothstep(0.0, 0.08, min(gridFract.x, gridFract.y));
            
            // Apply grid lines: blend in a faint cyan color
            vec3 gridColor = vec3(0.0, 0.5, 0.95);
            mapTexel.rgb = mix(gridColor, mapTexel.rgb, 0.94 + 0.06 * gridLine);
            
            // Add a tiny bit of procedural sensor noise
            vec2 blockId = floor(gridUv);
            float noise = fract(sin(dot(blockId, vec2(12.9898, 78.233))) * 43758.5453);
            
            // Add micro-sensor noise (intensity 0.03) over land/clouds to give high-res texture
            float isLand = step(0.18, length(mapTexel.rg - mapTexel.b));
            mapTexel.rgb += (noise - 0.5) * 0.03 * isLand;
            
            diffuseColor *= mapTexelToLinear( mapTexel );
          #endif
          `
        );
      };
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
