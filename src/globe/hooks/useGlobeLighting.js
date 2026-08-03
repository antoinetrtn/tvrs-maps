import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import { getOpaqueThreeColor, GLOBE_STYLE } from "../../config/designSystem";
import { PERFORMANCE } from "../../config/gameConstants";
import { FRESNEL_FRAGMENT_SHADER, FRESNEL_VERTEX_SHADER } from "../render/globeShaders";

export function useGlobeLighting({
  globeEl,
  isLight,
  globeLightingEnabled,
  UI_COLORS,
  perfProfile,
  globeTheme,
  safeColor,
}) {
  const globeLightingRef = useRef(null);
  const graticuleMaterialsRef = useRef([]);
  const graticuleCacheKeyRef = useRef("");
  const targetGlowColorRef = useRef(new THREE.Color(0x38bdf8));
  const targetGlowPowerRef = useRef(1.2);
  const targetGlowCoefRef = useRef(1.0);

  const updateGlobeLighting = useCallback(() => {
    const scene = globeEl.current?.scene?.();
    if (!scene) return false;

    if (!globeLightingEnabled) {
      if (globeLightingRef.current) {
        const { keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight, group } =
          globeLightingRef.current;
        const camera = globeEl.current?.camera?.();
        if (camera) {
          camera.remove(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight);
        }
        if (group && group.parent) {
          group.parent.remove(group);
        }
        globeLightingRef.current?.innerGlow?.geometry?.dispose();
        globeLightingRef.current?.innerGlow?.material?.dispose();
        globeLightingRef.current = null;
      }
      return true;
    }

    let justCreatedLighting = false;

    if (!globeLightingRef.current) {
      justCreatedLighting = true;
      const camera = globeEl.current?.camera?.();
      if (!camera) return false;
      scene.add(camera);

      const group = new THREE.Group();
      group.name = "globe-accent-lighting";

      const keyLight = new THREE.DirectionalLight(0xffffff, 1);
      keyLight.name = "globe-key-light";
      keyLight.position.set(-3.5, 2.4, 4.2);

      const rimLight = new THREE.DirectionalLight(0x78a8ff, 1);
      rimLight.name = "globe-rim-light";
      rimLight.position.set(3.8, 1.3, -3.6);

      const fillLight = new THREE.HemisphereLight(0x9cc4ff, 0x020617, 1);
      fillLight.name = "globe-fill-light";
      fillLight.position.set(0, 2.2, 0);

      const studioLight = new THREE.AmbientLight(0xbfdcff, 1);
      studioLight.name = "globe-studio-ambient";

      const studioLeft = new THREE.DirectionalLight(0xffffff, 1);
      studioLeft.name = "globe-studio-left";
      studioLeft.position.set(-4.5, 2.5, 3.5);

      const studioRight = new THREE.DirectionalLight(0x9fd2ff, 1);
      studioRight.name = "globe-studio-right";
      studioRight.position.set(4.5, -1.2, 2.8);

      const glowSegments = perfProfile?.isMobile
        ? PERFORMANCE.innerGlowSegments.mobile
        : PERFORMANCE.innerGlowSegments.desktop;
      const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(114.0, glowSegments, glowSegments),
        new THREE.ShaderMaterial({
          vertexShader: FRESNEL_VERTEX_SHADER,
          fragmentShader: FRESNEL_FRAGMENT_SHADER,
          uniforms: {
            glowColor: { value: new THREE.Color(0x64b5f6) },
            coef: { value: 1.0 },
            power: { value: 1.2 },
          },
          transparent: true,
          blending: THREE.NormalBlending,
          side: THREE.BackSide,
          depthWrite: false,
        })
      );
      innerGlow.name = "globe-inner-glow";
      innerGlow.position.set(0, 0, 0);
      innerGlow.renderOrder = -1;

      group.add(innerGlow);
      scene.add(group);

      camera.add(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight);

      globeLightingRef.current = {
        group,
        keyLight,
        rimLight,
        fillLight,
        studioLight,
        studioLeft,
        studioRight,
        innerGlow,
      };
    }

    const { keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight, innerGlow } =
      globeLightingRef.current;

    const isMobile = perfProfile?.isMobile;
    const lightScale = isMobile ? PERFORMANCE.mobileLightScale : 1;

    rimLight.visible = !UI_COLORS.isBlackoutTheme;
    studioLight.visible = true;
    studioLeft.visible = !UI_COLORS.isBlackoutTheme;
    studioRight.visible = !UI_COLORS.isBlackoutTheme;
    innerGlow.visible = true;

    if (justCreatedLighting) {
      scene.traverse((obj) => {
        if (obj.isLight && !obj.name.startsWith("globe-")) {
          obj.intensity = 0;
        }
      });
    }

    if (UI_COLORS.isBlackoutTheme) {
      // Blackout theme: front-offset headlight with low ambient for dramatic shadows
      keyLight.intensity = (isLight ? 0.35 : 1.3) * lightScale;
      keyLight.position.set(3.5, 2.0, 5.5);
      rimLight.intensity = 0;
      fillLight.intensity = (isLight ? 0.22 : 0.15) * lightScale;
      studioLight.intensity = (isLight ? 0.15 : 0.08) * lightScale;
      studioLeft.intensity = 0;
      studioLeft.position.set(-4.5, 2.5, 3.5);
      studioRight.intensity = 0;
      studioRight.position.set(4.5, -1.2, 2.8);
    } else {
      const isSatellite = globeTheme === "satellite";
      // Satellite theme: strong sun headlight placed front-right-top relative to the camera
      keyLight.intensity = (isSatellite ? 1.8 : isLight ? 0.12 : 0.16) * lightScale;
      keyLight.position.set(
        isSatellite ? 3.5 : -3.5,
        isSatellite ? 2.0 : 2.4,
        isSatellite ? 5.5 : 4.2
      );

      // Outline halo for atmospheric glow
      rimLight.intensity = (isSatellite ? 0.35 : isLight ? 0.14 : 0.24) * lightScale;
      rimLight.position.set(3.8, 1.3, -3.6);

      // Low ambient/fill light to keep the dark side realistic (not completely black, but dark)
      fillLight.intensity = (isSatellite ? 0.18 : isLight ? 0.72 : 0.68) * lightScale;
      studioLight.intensity = (isSatellite ? 0.08 : isLight ? 0.54 : 0.48) * lightScale;

      // Disable side lights in satellite mode to avoid washing out shadows
      studioLeft.intensity = (isSatellite ? 0.0 : isLight ? 0.08 : 0.1) * lightScale;
      studioLeft.position.set(-4.5, 2.5, 3.5);
      studioRight.intensity = (isSatellite ? 0.0 : isLight ? 0.08 : 0.1) * lightScale;
      studioRight.position.set(4.5, -1.2, 2.8);
    }

    rimLight.color.set(safeColor(UI_COLORS.lightingRim));
    fillLight.color.set(safeColor(UI_COLORS.lightingFill));
    fillLight.groundColor.set(safeColor(UI_COLORS.lightingGround));
    studioLight.color.set(safeColor(UI_COLORS.lightingStudio));
    studioLeft.color.set(safeColor(UI_COLORS.lightingLeft));
    studioRight.color.set(safeColor(UI_COLORS.lightingRight));

    const glowColorHex = isLight
      ? Number(UI_COLORS.glowColorHexLight) || Number(UI_COLORS.glowColorHex) || 0x3a76f0
      : Number(UI_COLORS.glowColorHexDark) || Number(UI_COLORS.glowColorHex) || 0x3a76f0;
    const glowPower = Number(UI_COLORS.glowPower) || 1.2;
    const glowCoef = Number(UI_COLORS.glowCoef) || 0.08;

    targetGlowColorRef.current.setHex(glowColorHex);
    targetGlowPowerRef.current = glowPower;
    targetGlowCoefRef.current = glowCoef;

    if (justCreatedLighting && innerGlow.material?.uniforms) {
      const u = innerGlow.material.uniforms;
      u.glowColor.value.copy(targetGlowColorRef.current);
      u.power.value = glowPower;
      u.coef.value = glowCoef;
    }

    return true;
  }, [
    isLight,
    globeLightingEnabled,
    UI_COLORS,
    perfProfile?.isMobile,
    globeTheme,
    safeColor,
    globeEl,
  ]);

  const styleGlobeGraticules = useCallback(() => {
    const scene = globeEl.current?.scene?.();
    if (!scene) return;

    const graticuleColor = new THREE.Color(getOpaqueThreeColor(UI_COLORS.graticule));
    const graticuleOpacity =
      Number(UI_COLORS.graticuleOpacity) ||
      (isLight
        ? GLOBE_STYLE.lighting.graticuleOpacity.light
        : GLOBE_STYLE.lighting.graticuleOpacity.dark);

    const cacheKey = `${globeTheme}-${UI_COLORS.graticule}-${isLight}`;
    if (graticuleCacheKeyRef.current !== cacheKey) {
      graticuleCacheKeyRef.current = cacheKey;
      graticuleMaterialsRef.current = [];
    }

    if (graticuleMaterialsRef.current.length === 0) {
      scene.traverse((obj) => {
        const material = obj.material;
        if (
          obj.type === "LineSegments" &&
          material?.type === "LineBasicMaterial" &&
          material.transparent === true
        ) {
          graticuleMaterialsRef.current.push(material);
        }
      });
    }

    graticuleMaterialsRef.current.forEach((material) => {
      material.color.copy(graticuleColor);
      material.opacity = graticuleOpacity;
      material.depthWrite = false;
      material.needsUpdate = true;
    });
  }, [isLight, UI_COLORS, globeTheme, globeEl]);

  useEffect(() => {
    updateGlobeLighting();

    return () => {
      if (globeLightingRef.current) {
        const { keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight, group } =
          globeLightingRef.current;
        const camera = globeEl.current?.camera?.();
        if (camera) {
          camera.remove(keyLight, rimLight, fillLight, studioLight, studioLeft, studioRight);
        }
        if (group && group.parent) {
          group.parent.remove(group);
        }
        globeLightingRef.current?.innerGlow?.geometry?.dispose();
        globeLightingRef.current?.innerGlow?.material?.dispose();
        globeLightingRef.current = null;
      }
    };
  }, [updateGlobeLighting, globeEl]);

  return {
    updateGlobeLighting,
    styleGlobeGraticules,
    globeLightingRef,
    targetGlowColorRef,
    targetGlowPowerRef,
    targetGlowCoefRef,
  };
}
