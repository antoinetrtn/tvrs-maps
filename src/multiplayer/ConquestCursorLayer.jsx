import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  createCursorObject,
  cursorPosition,
  disposeCursorObject,
} from "../globe/render/cursorSprites";
import {
  conquestCursorStore,
  CURSOR_SEND_INTERVAL_MS,
  CURSOR_STALE_MS,
  easeFactor,
  shouldSendCursor,
  slerpLatLng,
} from "./conquestCursors";
import { getPaletteEntry } from "./conquestLogic";

const getGlobe = () => (typeof window === "undefined" ? null : window.__TVRS_GLOBE_EL__);
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

/** Sends the local camera centre (throttled) while the match is live. */
function useCursorSender({ live, userId, sendCursor }) {
  const lastRef = useRef(null);
  useEffect(() => {
    if (!live || !userId) return undefined;
    const id = setInterval(() => {
      if (document.hidden) return;
      const pov = getGlobe()?.pointOfView?.();
      if (!pov) return;
      const now = Date.now();
      const next = { lat: pov.lat, lng: pov.lng };
      if (!shouldSendCursor(lastRef.current, next, now)) return;
      lastRef.current = { ...next, at: now };
      sendCursor?.({
        u: userId,
        lat: Number(next.lat.toFixed(3)),
        lng: Number(next.lng.toFixed(3)),
      });
    }, CURSOR_SEND_INTERVAL_MS);
    return () => clearInterval(id);
  }, [live, userId, sendCursor]);
}

/** Per-frame update of the orbs: ease toward the latest target, fade stale ones. */
function updateCursorObjects(state, players, dt) {
  const now = Date.now();
  const reduced = prefersReducedMotion();
  const seen = new Set();
  for (const target of conquestCursorStore.visible(now)) {
    const player = players.find((p) => p.user_id === target.userId);
    if (!player) continue;
    seen.add(target.userId);
    let entry = state.objects.get(target.userId);
    const color = getPaletteEntry(player.color).hex;
    if (entry && entry.object.userData.color !== color) {
      state.group.remove(entry.object);
      disposeCursorObject(entry.object);
      entry = null;
    }
    if (!entry) {
      const object = createCursorObject({ name: player.display_name, color });
      entry = { object, current: { lat: target.lat, lng: target.lng } };
      state.objects.set(target.userId, entry);
      state.group.add(object);
    }
    entry.current = slerpLatLng(entry.current, target, easeFactor(dt, reduced));
    cursorPosition(entry.current.lat, entry.current.lng, entry.object.position);
    const age = now - target.at;
    const opacity = age > CURSOR_STALE_MS - 1500 ? (CURSOR_STALE_MS - age) / 1500 : 1;
    entry.object.children.forEach((s) => (s.material.opacity = Math.max(0, opacity)));
  }
  for (const [uid, entry] of state.objects) {
    if (seen.has(uid)) continue;
    state.group.remove(entry.object);
    disposeCursorObject(entry.object);
    state.objects.delete(uid);
  }
}

/** Renders opponents' cursors in the globe scene (re-attaches after a renderer switch). */
function useCursorRenderer({ live, players }) {
  const playersRef = useRef(players);
  playersRef.current = players;
  useEffect(() => {
    if (!live) return undefined;
    const state = { group: new THREE.Group(), objects: new Map(), scene: null, last: 0 };
    state.group.name = "conquest-cursors";
    const detach = () => {
      state.group.parent?.remove(state.group);
      state.objects.forEach((e) => disposeCursorObject(e.object));
      state.objects.clear();
      state.group.clear();
    };
    let raf = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const scene = getGlobe()?.scene?.();
      if (!scene) return;
      if (state.scene !== scene) {
        detach();
        scene.add(state.group);
        state.scene = scene;
      }
      updateCursorObjects(state, playersRef.current || [], state.last ? t - state.last : 0);
      state.last = t;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      detach();
    };
  }, [live]);
}

/**
 * « Curseurs spatiaux » : each opponent appears as an orb in their colour,
 * floating above the point of the globe they are looking at.
 */
const ConquestCursorLayer = ({ conquest }) => {
  const live = conquest?.match?.status === "live";
  useCursorSender({ live, userId: conquest?.userId, sendCursor: conquest?.sendCursor });
  useCursorRenderer({ live, players: conquest?.players });
  return null;
};

export default ConquestCursorLayer;
