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
      return new THREE.MeshStandardMaterial({
        map: customGlobeTexture,
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.0,
      });
    }

    return new THREE.MeshPhongMaterial({
      color: UI_COLORS.mapSea,
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
