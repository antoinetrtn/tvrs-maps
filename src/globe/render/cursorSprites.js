/**
 * Three.js objects for Conquête spatial cursors: the « curseur terminal ».
 * A small square block that blinks in two steps next to a `> pseudo_` tag, a
 * dotted sight line and a « + » reticle laid on the surface. Everything is
 * authored in CSS pixels (1 local unit = 1 px once `setUnit` is applied), flat
 * unlit materials, no circles, no glow. Plain meshes: identical under the
 * WebGL and WebGPU renderers.
 */
import * as THREE from "three";

import { CONQUEST_CURSOR_STYLE } from "../../config/designSystem";

const CURSOR_ALTITUDE = 0.003; // globe radii above the surface (the reticle sits on it)
const GLOBE_RADIUS = 100;

const PIXEL_FONT = "'Bitcount Single', monospace";
const LABEL_FONT_PX = 10;
const LABEL_PAD_X = 3;
const LABEL_PAD_Y = 2;
const LABEL_MAX_CHARS = 12;
const STRIP_W = 2;
const BLOCK_W = 6;
const BLOCK_H = 10;
const PIN_H = 15; // block centre above the surface (px)
const GAP = 3; // block ↔ tag
/** Blink: 500 ms solid, 300 ms hollow (two steps, no tween). */
const BLINK_CYCLE_MS = 800;
const BLINK_SOLID_MS = 500;

/** lat/lng (deg) → position in globe space at the cursor altitude. */
export function cursorPosition(lat, lng, target = new THREE.Vector3()) {
  const r = GLOBE_RADIUS * (1 + CURSOR_ALTITUDE);
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  return target.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

const flat = (color, opts = {}) =>
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    ...opts,
  });

const nearest = (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
};

const texelRatio = () =>
  typeof window === "undefined"
    ? 1
    : Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));

/**
 * Binary-alpha tag texture (« > name_ »): the glyphs are rasterised at device
 * resolution then thresholded, so every texel is opaque or empty (crisp).
 * Sized in CSS px: w/h are the plane size.
 */
function makeTagTexture(text, color) {
  const ratio = texelRatio();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const fontPx = LABEL_FONT_PX * ratio;
  const font = `500 ${fontPx}px ${PIXEL_FONT}`;
  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(text).width);
  const w = textW + (LABEL_PAD_X * 2 + STRIP_W) * ratio;
  const h = (LABEL_FONT_PX + LABEL_PAD_Y * 2) * ratio;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = CONQUEST_CURSOR_STYLE.tagBg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, STRIP_W * ratio, h);
  ctx.textBaseline = "middle";
  ctx.fillStyle = CONQUEST_CURSOR_STYLE.tagText;
  ctx.fillText(text, (LABEL_PAD_X + STRIP_W) * ratio, h / 2 + ratio * 0.5);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  return { texture: nearest(new THREE.CanvasTexture(canvas)), w: w / ratio, h: h / ratio };
}

/** Short display name for the tag (the pseudo stays recognisable). */
export const tagName = (name) => {
  const clean = String(name || "?")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || "?").slice(0, LABEL_MAX_CHARS);
};

function hollowBlockTexture(color) {
  const c = document.createElement("canvas");
  c.width = BLOCK_W;
  c.height = BLOCK_H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, BLOCK_W, 1);
  ctx.fillRect(0, BLOCK_H - 1, BLOCK_W, 1);
  ctx.fillRect(0, 1, 1, BLOCK_H - 2);
  ctx.fillRect(BLOCK_W - 1, 1, 1, BLOCK_H - 2);
  return nearest(new THREE.CanvasTexture(c));
}

const _q = new THREE.Quaternion();

/**
 * One opponent's cursor. `anchor` is a surface frame (+Y = normal) whose scale
 * is set to « world units per px » by the layer, so the cursor keeps a
 * constant on-screen size at any zoom (mobile included).
 */
export function createCursorObject({ name, color }) {
  const anchor = new THREE.Group();
  anchor.name = "conquest-cursor";
  const materials = [];
  const track = (m) => (materials.push(m), m);

  // « + » reticle lying on the surface.
  const crossMat = track(flat(color));
  const arm = (w, h) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, crossMat);
    mesh.position.y = 0.2;
    mesh.renderOrder = 10;
    return mesh;
  };
  anchor.add(arm(5, 1), arm(1, 5));

  // Billboard pin: sight line + blinking block + tag.
  const pin = new THREE.Group();
  anchor.add(pin);
  const dotMat = track(flat(CONQUEST_CURSOR_STYLE.sightline));
  const dotGeo = new THREE.PlaneGeometry(1, 1);
  for (const y of [3, 5.5, 8]) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0, y, 0);
    dot.renderOrder = 10;
    pin.add(dot);
  }
  const solidMat = track(flat(color));
  const blockGeo = new THREE.PlaneGeometry(BLOCK_W, BLOCK_H);
  const solid = new THREE.Mesh(blockGeo, solidMat);
  const hollowTex = hollowBlockTexture(color);
  const hollowMat = track(flat("white", { map: hollowTex }));
  const hollow = new THREE.Mesh(blockGeo, hollowMat);
  for (const m of [solid, hollow]) {
    m.position.set(0, PIN_H, 0);
    m.renderOrder = 11;
    pin.add(m);
  }

  const tags = { on: null, off: null, w: 0, h: 0 };
  const label = new THREE.Group();
  label.position.set(0, PIN_H, 0);
  pin.add(label);
  let rawName = name;
  let currentName = tagName(name);

  const buildTags = () => {
    for (const key of ["on", "off"]) {
      const old = tags[key];
      if (old) {
        label.remove(old);
        old.material.map?.dispose();
        old.material.dispose();
        old.geometry.dispose();
        materials.splice(materials.indexOf(old.material), 1);
      }
    }
    // The tag is the « terminal » prompt: the `_` blinks in anti-phase with the block.
    const a = makeTagTexture(`> ${currentName}_`, color);
    const b = makeTagTexture(`> ${currentName} `, color);
    tags.w = a.w;
    tags.h = a.h;
    for (const [key, t] of [
      ["on", a],
      ["off", b],
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(t.w, t.h),
        track(flat("white", { map: t.texture }))
      );
      mesh.renderOrder = 12;
      tags[key] = mesh;
      label.add(mesh);
    }
  };
  buildTags();

  // The pixel font loads late on a cold start: redraw the tag once it is there.
  let disposed = false;
  if (typeof document !== "undefined" && document.fonts?.load) {
    document.fonts
      .load(`500 ${LABEL_FONT_PX}px ${PIXEL_FONT}`)
      .then(() => (disposed ? null : buildTags()))
      .catch(() => {});
  }

  let lastLeft = null;
  let lastBelow = null;
  const api = {
    anchor,
    pin,
    /** Tag width (px) — the layer needs it to keep the tag on screen. */
    tagWidth: () => tags.w,
    setName(next) {
      if (next === rawName) return;
      rawName = next;
      const n = tagName(next);
      if (n === currentName) return;
      currentName = n;
      buildTags();
      lastLeft = null;
    },
    /** Per frame: billboard the pin, blink, place the tag. `placement` = { left, below }. */
    update({ camera, t, placement, reduced }) {
      anchor.getWorldQuaternion(_q).invert().multiply(camera.quaternion);
      pin.quaternion.copy(_q);
      const solidPhase = reduced || t % BLINK_CYCLE_MS < BLINK_SOLID_MS;
      solid.visible = solidPhase;
      hollow.visible = !solidPhase;
      tags.on.visible = !solidPhase;
      tags.off.visible = solidPhase;
      const left = Boolean(placement?.left);
      const below = Boolean(placement?.below);
      if (left !== lastLeft || below !== lastBelow) {
        lastLeft = left;
        lastBelow = below;
        const half = tags.w / 2;
        if (below) {
          // Near the top edge: the tag drops under the block, flush with its outer side.
          const x = (left ? -1 : 1) * (half - BLOCK_W / 2);
          label.position.set(x, PIN_H - (BLOCK_H / 2 + tags.h / 2 + 2), 0);
        } else {
          label.position.set((left ? -1 : 1) * (BLOCK_W / 2 + GAP + half), PIN_H, 0);
        }
      }
    },
    setOpacity(o) {
      for (const m of materials) m.opacity = o;
    },
    /** World units per CSS px at the cursor's depth. */
    setUnit(unit) {
      anchor.scale.setScalar(unit);
    },
    dispose() {
      disposed = true;
      hollowTex.dispose();
      blockGeo.dispose();
      dotGeo.dispose();
      anchor.traverse((o) => {
        if (o.geometry && o.geometry !== blockGeo && o.geometry !== dotGeo) o.geometry.dispose();
      });
      for (const m of materials) {
        if (m.map && m.map !== hollowTex) m.map.dispose();
        m.dispose();
      }
      anchor.removeFromParent();
    },
  };
  return api;
}

export const CURSOR_PIN_HEIGHT_PX = PIN_H;
