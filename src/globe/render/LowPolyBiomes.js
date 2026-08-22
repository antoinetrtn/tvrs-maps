import * as THREE from "three";

import { FOUND_SURFACE_GREEN, getFoundGreenThreeColor } from "./foundGreenPalette";

export const mountainGlitchUniforms = {
  uTime: { value: 0 },
  uIsError: { value: 0 },
  uIsSuccess: { value: 0 },
  uFoundGreen: { value: getFoundGreenThreeColor().clone() },
};

// Cache for shared geometries and materials to avoid recreation and boost performance
const cache = {
  geometries: {},
  materials: {},
};

// Helper to get or create a shared geometry
const getGeometry = (key, creator) => {
  if (!cache.geometries[key]) {
    cache.geometries[key] = creator();
  }
  return cache.geometries[key];
};

// Helper to get or create a shared material
const getMaterial = (key, creator) => {
  if (!cache.materials[key]) {
    cache.materials[key] = creator();
  }
  return cache.materials[key];
};

// Clear cache on hot reload or disposal
export const disposeBiomeCache = () => {
  Object.values(cache.geometries).forEach((g) => g.dispose());
  Object.values(cache.materials).forEach((m) => m.dispose());
  cache.geometries = {};
  cache.materials = {};
};

// Helper to interpolate a point at parameter t (0 to 1) along a polyline path
const interpolatePath = (path, t) => {
  if (!path || path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];

  const segments = path.length - 1;
  const rawIndex = t * segments;
  const index = Math.min(segments - 1, Math.floor(rawIndex));
  const frac = rawIndex - index;

  const p1 = path[index];
  const p2 = path[index + 1];

  const lat = p1[0] + (p2[0] - p1[0]) * frac;
  const lng = p1[1] + (p2[1] - p1[1]) * frac;
  return [lat, lng];
};
const createSinglePeakMesh = (peakRadius, peakHeight, activeMat, posX, posY, posZ, rotY) => {
  const peakGeoKey = `peakGeo_${peakRadius.toFixed(4)}_${peakHeight.toFixed(4)}`;
  const peakGeo = getGeometry(peakGeoKey, () => {
    const geo = new THREE.ConeGeometry(peakRadius, peakHeight, 8, 4);
    const pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j);
      const y = pos.getY(j);
      const z = pos.getZ(j);
      if (y > -peakHeight / 2) {
        const angle = Math.atan2(z, x);
        const noise = Math.sin(angle * 4) * 0.03 + Math.cos(y * 18) * 0.015;
        pos.setX(j, x + x * noise);
        pos.setZ(j, z + z * noise);
      }
    }
    geo.computeVertexNormals();
    return geo;
  });

  const peak = new THREE.Mesh(peakGeo, activeMat);
  peak.position.set(posX, posY, posZ);
  peak.rotation.y = rotY;
  return peak;
};

export const createMountainFeature = (
  themeName = "dark",
  isSelected = false,
  isFound = false,
  bearing = 0,
  spread = 1.5,
  height = 4000,
  path = null,
  centerLat = 0,
  centerLng = 0,
  groupScale = 9.2,
  foundColor = null
) => {
  const group = new THREE.Group();
  const isLight = themeName === "light";

  const foundMatKey = `mountainFound_${themeName}_${foundColor || "default"}`;
  const foundMat = getMaterial(foundMatKey, () => {
    const col = new THREE.Color(foundColor || FOUND_SURFACE_GREEN);
    return new THREE.MeshPhongMaterial({
      color: col,
      emissive: 0x000000,
      shininess: 10,
      flatShading: true,
    });
  });

  const glitchMatKey = `mountainGlitch_${themeName}_${isLight ? "light" : "dark"}`;
  const glitchMat = getMaterial(glitchMatKey, () => {
    const mat = new THREE.MeshPhongMaterial({
      flatShading: true,
      shininess: 0,
      specular: 0x000000,
    });
    mat.customProgramCacheKey = () => `mountain-glitch-${themeName}-${isLight ? "light" : "dark"}`;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = mountainGlitchUniforms.uTime;
      shader.uniforms.uIsError = mountainGlitchUniforms.uIsError;
      shader.uniforms.uIsSuccess = mountainGlitchUniforms.uIsSuccess;
      shader.uniforms.uFoundGreen = mountainGlitchUniforms.uFoundGreen;
      shader.uniforms.uIsLight = { value: isLight ? 1.0 : 0.0 };

      shader.vertexShader = `
        varying vec3 vLocalPosition;
      ${shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
        vLocalPosition = position;
        `
      )}`;

      shader.fragmentShader = `
        varying vec3 vLocalPosition;
        uniform float uTime;
        uniform float uIsLight;
        uniform float uIsError;
        uniform float uIsSuccess;
        uniform vec3 uFoundGreen;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
      ${shader.fragmentShader.replace(
        `#include <dithering_fragment>`,
        `
        #include <dithering_fragment>
        vec2 noiseUv = vLocalPosition.xy * 8.0 + vec2(vLocalPosition.z * 4.0);
        float t = uTime * 28.0;
        float noise = hash(noiseUv + sin(t));

        float baseMin = (uIsLight > 0.5) ? 0.65 : 0.12;
        float baseMax = (uIsLight > 0.5) ? 0.98 : 0.68;
        float scanline = sin(vLocalPosition.y * 15.0 + uTime * 5.0) * ((uIsLight > 0.5) ? 0.03 : 0.07);

        float staticColor = mix(baseMin, baseMax, noise) + scanline;
        vec3 finalColor = vec3(staticColor);

        if (uIsError > 0.5) {
          float pulse = sin(uTime * 18.0) * 0.35 + 0.65;
          float sweep = step(fract(vLocalPosition.y * 1.5 - uTime * 4.0), 0.35) * 0.40;
          float errorNoise = hash(noiseUv + sin(uTime * 45.0));
          float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, errorNoise);
          vec3 errorRed = vec3(1.0, 0.27, 0.0);
          finalColor = errorRed * (noisyIntensity + 0.4);
        }

        if (uIsSuccess > 0.5) {
          float pulse = sin(uTime * 18.0) * 0.35 + 0.65;
          float sweep = step(fract(vLocalPosition.y * 1.5 - uTime * 4.0), 0.35) * 0.40;
          float successNoise = hash(noiseUv + sin(uTime * 45.0));
          float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, successNoise);
          finalColor = uFoundGreen * noisyIntensity;
        }

        gl_FragColor.rgb = finalColor;
        `
      )}`;
    };
    return mat;
  });

  const baseMatKey = `mountainBase_${themeName}`;
  const baseMat = getMaterial(
    baseMatKey,
    () =>
      new THREE.MeshPhongMaterial({
        color: isLight ? 0x475569 : 0x8ba2b5,
        emissive: isLight ? 0x000000 : 0x111620,
        specular: isLight ? 0x222222 : 0x444444,
        shininess: 15,
        flatShading: true,
      })
  );

  const activeMat = isFound ? foundMat : isSelected ? glitchMat : baseMat;

  if (path && Array.isArray(path) && path.length > 0) {
    let pathArcLength = 0;
    for (let k = 0; k < path.length - 1; k++) {
      const dLat = path[k + 1][0] - path[k][0];
      const dLng = path[k + 1][1] - path[k][1];
      pathArcLength += Math.sqrt(dLat * dLat + dLng * dLng);
    }
    const N = Math.max(22, Math.round(Math.max(spread * 8.5, pathArcLength * 2.2)));

    for (let i = 0; i < N; i++) {
      const tNorm = N > 1 ? i / (N - 1) : 0.5;
      const [pLat, pLng] = interpolatePath(path, tNorm);

      const [pLatNext, pLngNext] = interpolatePath(path, Math.min(1, tNorm + 0.05));
      const tanLat = pLatNext - pLat;
      const tanLng = pLngNext - pLng;
      const tanLen = Math.sqrt(tanLat * tanLat + tanLng * tanLng) || 1;
      const perpLat = -tanLng / tanLen;
      const perpLng = tanLat / tanLen;

      const R = 100;
      const latRad = (pLat * Math.PI) / 180;

      const ridgeOffset =
        (Math.sin(i * 17.1) * 0.45 + Math.cos(i * 31.3) * 0.35) * (spread / groupScale);
      const effLat = pLat + perpLat * ridgeOffset;
      const effLng = pLng + perpLng * ridgeOffset;

      const dx = R * Math.cos(latRad) * (effLng - centerLng) * (Math.PI / 180);
      const dz = R * (effLat - centerLat) * (Math.PI / 180);

      const localX = dx / groupScale;
      const localZ = -dz / groupScale;

      const dWorld = Math.sqrt(localX * localX + localZ * localZ) * groupScale;
      const deltaYWorld = R - Math.sqrt(Math.max(0.1, R * R - dWorld * dWorld));
      const deltaY = deltaYWorld / groupScale;

      const t = tNorm - 0.5;
      const bellFactor = Math.cos(t * Math.PI * 0.85);

      const randomHeightVar = 0.65 + ((Math.sin(i * 14.3) + 1) / 2) * 0.75;
      const randomRadiusVar = 0.8 + ((Math.cos(i * 22.7) + 1) / 2) * 0.55;
      const hFactor = Math.max(0.35, bellFactor * randomHeightVar);

      const normalizedHeightScale = height / 5000;
      const peakHeight = 0.32 * hFactor * normalizedHeightScale;
      const peakRadius = peakHeight * 0.46 * randomRadiusVar;

      const peak = createSinglePeakMesh(
        peakRadius,
        peakHeight,
        activeMat,
        localX,
        peakHeight / 2 - deltaY,
        localZ,
        (i * 19.3) % (Math.PI * 2)
      );
      group.add(peak);
    }
  } else {
    const N = Math.max(22, Math.round(spread * 8.5));
    const R = 100;
    const spreadWorld = R * spread * (Math.PI / 180);
    const localSpread = spreadWorld / groupScale;
    const rad = ((bearing || 0) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dz = Math.sin(rad);
    const perpX = -dz;
    const perpZ = dx;

    for (let i = 0; i < N; i++) {
      const tNorm = N > 1 ? i / (N - 1) : 0.5;
      const t = tNorm - 0.5;
      const bellFactor = Math.cos(t * Math.PI * 0.85);
      const randomHeightVar = 0.65 + ((Math.sin(i * 14.3) + 1) / 2) * 0.75;
      const randomRadiusVar = 0.8 + ((Math.cos(i * 22.7) + 1) / 2) * 0.55;
      const hFactor = Math.max(0.35, bellFactor * randomHeightVar);

      let X = t * localSpread * dx;
      let Z = t * localSpread * dz;

      const randOffsetVal = (Math.sin(i * 92.4) + Math.cos(i * 12.3)) * 0.7;
      X += randOffsetVal * 0.065 * localSpread * perpX;
      Z += randOffsetVal * 0.065 * localSpread * perpZ;

      const dWorld = Math.sqrt(X * X + Z * Z) * groupScale;
      const deltaYWorld = R - Math.sqrt(Math.max(0.1, R * R - dWorld * dWorld));
      const deltaY = deltaYWorld / groupScale;

      const normalizedHeightScale = height / 5000;
      const peakHeight = 0.32 * hFactor * normalizedHeightScale;
      const peakRadius = peakHeight * 0.46 * randomRadiusVar;

      const peak = createSinglePeakMesh(
        peakRadius,
        peakHeight,
        activeMat,
        X,
        peakHeight / 2 - deltaY,
        Z,
        (i * 19.3) % (Math.PI * 2)
      );
      group.add(peak);
    }
  }

  // Force culling and optimize shadows
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
    }
  });

  return group;
};
