import * as THREE from "three";

/**
 * Smooth "painted" high-res France terrain for the regional (Départements) mode.
 * 2048x1366 WebP (~135 KB, NASA Blue Marble NG 500 m, scripts/build-painted-france.py),
 * fetched lazily the first time a regional map is shown: never part of the JS bundle,
 * never downloaded in world modes. Until it decodes, uPaintedReady = 0 and the shaders
 * keep the current look. Linear + mipmaps (painted = smooth, not pixel art); the thin
 * pixel borders and the amber selection outline are drawn on top and stay crisp.
 */
export const PAINTED_FRANCE_BOUNDS = { lngMin: -5.6, lngMax: 10.0, latMin: 41.0, latMax: 51.4 };
const PAINTED_URL = "/textures/painted-france-2048.webp";

const b = PAINTED_FRANCE_BOUNDS;
// cartUv = (lng / 360 + 0.5, lat / 180 + 0.5) in both shaders.
export const PAINTED_RECT = new THREE.Vector4(
  b.lngMin / 360 + 0.5,
  b.latMin / 180 + 0.5,
  (b.lngMax - b.lngMin) / 360,
  (b.latMax - b.latMin) / 180
);

function placeholder() {
  const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export const paintedTerrainUniforms = {
  uPaintedMap: { value: placeholder() },
  uPaintedRect: { value: PAINTED_RECT },
  uPaintedReady: { value: 0 },
};

const listeners = new Set();
export function onPaintedTerrainReady(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let requested = false;
export function ensurePaintedTerrain() {
  if (requested || typeof Image === "undefined") return;
  requested = true;
  new THREE.TextureLoader().load(
    PAINTED_URL,
    (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 4;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      paintedTerrainUniforms.uPaintedMap.value = tex;
      paintedTerrainUniforms.uPaintedReady.value = 1;
      listeners.forEach((fn) => fn(tex));
    },
    undefined,
    () => {
      requested = false;
    }
  );
}

export const PAINTED_GLSL_DECLARATIONS = `
    uniform sampler2D uPaintedMap;
    uniform vec4 uPaintedRect;
    uniform float uPaintedReady;
`;

/**
 * Painted France on unfound regional caps (rest state of the home and the game). Night
 * grade: a touch darker and cooler than the source; awakened (found) caps keep their
 * tone and only borrow the painted relief as a light luminance modulation.
 */
export const PAINTED_GLSL_BODY = `
      vec2 paintedUv = (cartUv - uPaintedRect.xy) / uPaintedRect.zw;
      float paintedIn = step(0.0, paintedUv.x) * step(paintedUv.x, 1.0) * step(0.0, paintedUv.y) * step(paintedUv.y, 1.0);
      vec4 paintedSample = texture2D(uPaintedMap, clamp(paintedUv, 0.0, 1.0));
      float paintedAmt = uPaintedReady * uIsRegionalMode * (1.0 - uIsGhost) * paintedIn * paintedSample.a;
      vec3 paintedNight = paintedSample.rgb * (0.78 + 0.16 * (1.0 - ndv)) * vec3(0.94, 0.98, 1.06);
      float paintedLuma = dot(paintedSample.rgb, vec3(0.299, 0.587, 0.114));
      landSurface = mix(landSurface, paintedNight, paintedAmt * isUnfoundDarkCap * 0.94);
      landSurface *= mix(1.0, 0.7 + paintedLuma * 1.2, paintedAmt * isAwakenedCap * 0.6);
`;
