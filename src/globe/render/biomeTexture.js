import * as THREE from "three";

import { bakeLandcover } from "./worldPalette";

/**
 * 1440x720 (0.25°/texel) NearestFilter RGBA texture of baked pixel-art land
 * cover, built from real NASA Blue Marble classes (public/textures/
 * world-landcover-1440.png, see scripts/build-world-landcover.py). One fetch in
 * the shaders, hard square texels, no mipmaps, no blur. Alpha = data present:
 * the texture starts empty (alpha 0 → shaders keep the current look) and is
 * filled in place once the 200 KB PNG is decoded.
 */
const BIOME_TEX_WIDTH = 1440;
const BIOME_TEX_HEIGHT = 720;
const LANDCOVER_URL = "/textures/world-landcover-1440.png";

let sharedBiomeTexture = null;

function loadLandcoverInto(tex) {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = BIOME_TEX_WIDTH;
    canvas.height = BIOME_TEX_HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, BIOME_TEX_WIDTH, BIOME_TEX_HEIGHT).data;
    const grey = new Uint8Array(BIOME_TEX_WIDTH * BIOME_TEX_HEIGHT);
    for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4];
    tex.image.data.set(bakeLandcover(grey, BIOME_TEX_WIDTH, BIOME_TEX_HEIGHT));
    tex.needsUpdate = true;
  };
  img.src = LANDCOVER_URL;
}

export function getBiomeTexture() {
  if (sharedBiomeTexture) return sharedBiomeTexture;
  const data = new Uint8Array(BIOME_TEX_WIDTH * BIOME_TEX_HEIGHT * 4);
  const tex = new THREE.DataTexture(data, BIOME_TEX_WIDTH, BIOME_TEX_HEIGHT, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  sharedBiomeTexture = tex;
  loadLandcoverInto(tex);
  return tex;
}
