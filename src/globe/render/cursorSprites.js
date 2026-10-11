/**
 * Three.js objects for Conquête spatial cursors: one glowing orb + name tag
 * per opponent, floating above the globe. Plain Sprites (one draw call each,
 * auto-converted to node materials under WebGPURenderer).
 */
import * as THREE from "three";

const CURSOR_ALTITUDE = 0.16; // globe radii above the surface
const GLOBE_RADIUS = 100;
// Constant on-screen size (sizeAttenuation off): readable at any zoom, mobile too.
const ORB_SIZE = 0.05;
const LABEL_HEIGHT = 0.032;

let orbTexture = null;
function getOrbTexture() {
  if (orbTexture || typeof document === "undefined") return orbTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.28, "rgba(255,255,255,0.95)");
  g.addColorStop(0.42, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  orbTexture = new THREE.CanvasTexture(canvas);
  orbTexture.colorSpace = THREE.SRGBColorSpace;
  return orbTexture;
}

function makeLabelTexture(name, color) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "600 30px 'Space Grotesk', system-ui, sans-serif";
  ctx.font = font;
  const text = String(name || "?").slice(0, 18);
  const width = Math.ceil(ctx.measureText(text).width) + 44;
  canvas.width = width;
  canvas.height = 48;
  ctx.font = font;
  ctx.fillStyle = "rgba(10, 12, 16, 0.82)";
  ctx.fillRect(0, 0, width, 48);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 48); // player colour strip (hard edge, DS style)
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 22, 25);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / 48 };
}

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

/** Orb + label group for one opponent. */
export function createCursorObject({ name, color }) {
  const group = new THREE.Group();
  group.name = "conquest-cursor";
  const orb = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getOrbTexture(),
      color: new THREE.Color(color),
      transparent: true,
      depthWrite: false,
      sizeAttenuation: false,
    })
  );
  orb.scale.set(ORB_SIZE, ORB_SIZE, 1);
  const { texture, aspect } = makeLabelTexture(name, color);
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: false,
    })
  );
  label.scale.set(LABEL_HEIGHT * aspect, LABEL_HEIGHT, 1);
  label.center.set(-0.12, -0.55); // tag sits up-right of the orb
  label.renderOrder = 3;
  orb.renderOrder = 3;
  group.add(orb, label);
  group.userData = { name, color };
  return group;
}

export function disposeCursorObject(group) {
  group.children.forEach((sprite) => {
    if (sprite.material.map && sprite.material.map !== orbTexture) sprite.material.map.dispose();
    sprite.material.dispose();
  });
}
