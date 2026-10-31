import "./ConquestCursors.css";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { countryDataMap } from "../data/gameData";
import {
  createCountryHighlight,
  featurePolygons,
  llToXyz,
  polygonsAnchor,
  surfaceRadius,
} from "../globe/render/countryHighlight";
import { createCursorLink } from "../globe/render/cursorLink";
import {
  createCursorObject,
  CURSOR_PIN_HEIGHT_PX,
  cursorPosition,
} from "../globe/render/cursorSprites";
import { isSameAdmin } from "../globe/render/polygonColorResolver";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { getFeatureAdmin } from "../utils/utils";
import { createHintPool } from "./conquestCursorHints";
import {
  buildCursorPayload,
  conquestCursorStore,
  createCursorMotion,
  CURSOR_SEND_INTERVAL_MS,
  CURSOR_STALE_MS,
  extrapolateTarget,
  shouldSendCursor,
  toUnit,
} from "./conquestCursors";
import {
  assignHighlightSlots,
  edgeHintPlacement,
  isBeyondHorizon,
  labelPlacement,
} from "./conquestCursorView";
import { getPaletteEntry } from "./conquestLogic";

const GLOBE_RADIUS = 100;
const getGlobe = () => (typeof window === "undefined" ? null : window.__TVRS_GLOBE_EL__);

/** Highlight altitudes (globe radii): above the polygon caps, higher if the local selection is there too. */
const HIGHLIGHT_ALT = 0.003;
const HIGHLIGHT_ALT_UNDER_SELF = 0.0115;
const LINK_MIN_ANGLE = 0.012; // rad: closer than this the pin already sits on the country
const STALE_FADE_MS = 1500;
/**
 * Screen margins (px) kept free for the edge hints, so they never sit under
 * the Conquête HUD: scoreboard on top, live feed + answer box at the bottom
 * (taller on phones, where they span the whole width).
 */
const hintInset = (w) =>
  w < 700
    ? { left: 10, right: 10, top: 124, bottom: 176 }
    : { left: 12, right: 12, top: 128, bottom: 100 };

/** Sends the local camera centre + selected country (throttled) while the match is live. */
function useCursorSender({ live, userId, sendCursor, selectedCountryId }) {
  const lastRef = useRef(null);
  const selectedRef = useRef(selectedCountryId);
  selectedRef.current = selectedCountryId || null;
  useEffect(() => {
    if (!live || !userId) return undefined;
    const id = setInterval(() => {
      if (document.hidden) return;
      const pov = getGlobe()?.pointOfView?.();
      if (!pov) return;
      const now = Date.now();
      const next = { lat: pov.lat, lng: pov.lng, country: selectedRef.current };
      if (!shouldSendCursor(lastRef.current, next, now)) return;
      lastRef.current = { ...next, at: now };
      sendCursor?.(buildCursorPayload(userId, next));
    }, CURSOR_SEND_INTERVAL_MS / 2);
    return () => clearInterval(id);
  }, [live, userId, sendCursor]);
}

/** admin → feature, plus a resolver for the ids the match uses (codes / names). */
const featureIndexOf = (countriesData) => {
  const index = new Map();
  for (const f of countriesData || []) {
    const id = getFeatureAdmin(f);
    if (id && !index.has(id)) index.set(id, f);
  }
  const cache = new Map();
  const resolve = (id) => {
    if (!id) return null;
    if (index.has(id)) return id;
    if (cache.has(id)) return cache.get(id);
    let found = null;
    for (const admin of index.keys()) {
      if (isSameAdmin(admin, id)) {
        found = admin;
        break;
      }
    }
    cache.set(id, found);
    return found;
  };
  return { index, resolve };
};

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _pin = new THREE.Vector3();
const _cam = [0, 0, 0];
const _dir = [0, 0, 0];

/** Per-frame update of every opponent's cursor, highlight, link and edge hint. */
function updateFrame(state, ctx, dt) {
  const { camera, canvas, players, features, resolve } = ctx;
  const selfCountry = resolve(ctx.selfCountryId);
  const now = Date.now();
  const reduced = prefersReducedMotion();
  // The globe canvas is larger than the screen (it bleeds around it): edge
  // logic works on the visible viewport, projection on the canvas.
  const box = canvas.getBoundingClientRect();
  const rect = { width: window.innerWidth, height: window.innerHeight };
  const viewH = Math.max(1, box.height);
  const fovTan = Math.tan(((camera.fov || 50) * Math.PI) / 360);
  camera.updateMatrixWorld();
  _cam[0] = camera.position.x;
  _cam[1] = camera.position.y;
  _cam[2] = camera.position.z;

  const targets = conquestCursorStore
    .visible(now)
    .map((t) => ({ ...t, player: players.find((p) => p.user_id === t.userId) }))
    .filter((t) => t.player);
  const slots = assignHighlightSlots(
    targets.map((t) => ({ userId: t.userId, country: resolve(t.country) })),
    selfCountry
  );
  const seen = new Set();

  for (const target of targets) {
    const { userId, player } = target;
    seen.add(userId);
    const color = getPaletteEntry(player.color).hex;
    let entry = state.entries.get(userId);
    if (entry && entry.color !== color) {
      disposeEntry(entry);
      state.entries.delete(userId);
      entry = null;
    }
    if (!entry) {
      const object = createCursorObject({ name: player.display_name, color });
      state.group.add(object.anchor);
      entry = {
        color,
        object,
        motion: createCursorMotion(target),
        placement: { left: false, below: false },
        hl: null,
        hlKey: "",
        link: null,
      };
      state.entries.set(userId, entry);
    }
    entry.object.setName(player.display_name);

    // Motion: extrapolate the last sample, then spring toward it at display rate.
    const goal = extrapolateTarget(target, now - target.at);
    const ll = entry.motion.step(dt, reduced ? toUnit(target) : goal, { reduced });
    const age = now - target.at;
    const opacity =
      age > CURSOR_STALE_MS - STALE_FADE_MS
        ? Math.max(0, (CURSOR_STALE_MS - age) / STALE_FADE_MS)
        : 1;

    const anchor = entry.object.anchor;
    cursorPosition(ll.lat, ll.lng, anchor.position);
    _n.copy(anchor.position).normalize();
    anchor.quaternion.setFromUnitVectors(_up, _n);
    const dist = camera.position.distanceTo(anchor.position);
    const unit = (2 * dist * fovTan) / viewH;
    entry.object.setUnit(unit);
    anchor.updateMatrixWorld(true);

    _dir[0] = _n.x;
    _dir[1] = _n.y;
    _dir[2] = _n.z;
    const beyond = isBeyondHorizon(_dir, _cam, GLOBE_RADIUS);

    // Projected top of the pin → screen position (for label side + on-screen test).
    // The pin is a billboard: its « up » is the screen's up, not the surface normal.
    _pin
      .copy(_up)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(CURSOR_PIN_HEIGHT_PX * unit)
      .add(anchor.position);
    _v.copy(_pin).project(camera);
    const sx = box.left + (_v.x * 0.5 + 0.5) * box.width;
    const sy = box.top + (-_v.y * 0.5 + 0.5) * box.height;
    const onScreen =
      !beyond && _v.z < 1 && sx > 6 && sx < rect.width - 6 && sy > 6 && sy < rect.height - 6;

    const showCursor = !beyond;
    anchor.visible = showCursor && onScreen;
    if (showCursor) {
      entry.placement = labelPlacement(sx, sy, entry.object.tagWidth(), rect, entry.placement);
      entry.object.update({ camera, t: now, placement: entry.placement, reduced });
      entry.object.setOpacity(opacity);
    }

    // Edge hint: cursor out of sight (behind the globe or off-screen).
    if (onScreen) {
      state.hints.hide(userId);
    } else {
      _v.copy(_pin).applyMatrix4(camera.matrixWorldInverse);
      const place = edgeHintPlacement(_v.x, -_v.y, rect, hintInset(rect.width));
      state.hints.show(userId, {
        name: player.display_name,
        color,
        x: place.x,
        y: place.y,
        dir: place.dir,
        leftSide: place.x > rect.width / 2,
      });
    }

    updateHighlight(state, entry, {
      target,
      slots,
      features,
      selfCountry,
      resolve,
      opacity,
      anchor,
      onScreen,
      unit,
      camera,
    });
  }

  for (const [userId, entry] of state.entries) {
    if (seen.has(userId)) continue;
    disposeEntry(entry);
    state.entries.delete(userId);
  }
  state.hints.prune(seen);
}

/** Country surface + outline + link line of one opponent's selection. */
function updateHighlight(state, entry, ctx) {
  const { target, slots, features, selfCountry, resolve, opacity, anchor, onScreen, unit, camera } =
    ctx;
  const country = resolve(target.country);
  const slot = country ? slots.get(target.userId) : null;
  const alt = country && country === selfCountry ? HIGHLIGHT_ALT_UNDER_SELF : HIGHLIGHT_ALT;
  const name = target.player?.display_name || "";
  const key = country
    ? `${country}|${entry.color}|${slot?.slot}|${slot?.count}|${alt}|${name}`
    : "";
  if (key !== entry.hlKey) {
    entry.hl?.handle.dispose();
    entry.hl = null;
    entry.hlKey = key;
    if (country) {
      const polygons = featurePolygons(features.get(country));
      if (polygons.length) {
        const centroid = countryDataMap[country] || polygonsAnchor(polygons);
        const handle = createCountryHighlight(polygons, {
          color: entry.color,
          alt,
          slot: slot.slot,
          count: slot.count,
          name,
          centroid,
        });
        state.group.add(handle.group);
        entry.hl = { handle, country, anchorLL: centroid, alt };
      }
    }
  }
  if (!entry.hl) {
    entry.link?.hide();
    return;
  }
  entry.hl.handle.setOpacity(opacity);
  entry.hl.handle.setPixelUnit(unit);

  const a = entry.hl.anchorLL ? llToXyz(entry.hl.anchorLL.lat, entry.hl.anchorLL.lng, 1) : null;
  const beyond = !a || !onScreen || isBeyondHorizon(a, _cam, GLOBE_RADIUS);
  entry.hl.handle.update?.({ camera, visible: !beyond });

  // Link: dotted arc from the cursor pin to the country's anchor point. Both
  // ends must be in view (the link is drawn over the globe, not depth-tested).
  if (!entry.link) {
    entry.link = createCursorLink({ color: entry.color });
    state.group.add(entry.link.group);
  }
  if (beyond) {
    entry.link.hide();
    return;
  }
  _n.copy(anchor.position).normalize();
  entry.link.update({
    a,
    b: [_n.x, _n.y, _n.z],
    rA: surfaceRadius(entry.hl.alt + 0.002),
    rB: _pin.length(),
    unit,
    camera,
    opacity,
    minAngle: LINK_MIN_ANGLE,
  });
}

function disposeEntry(entry) {
  entry.object.dispose();
  entry.hl?.handle.dispose();
  entry.link?.dispose();
}

/** Renders opponents' cursors in the globe scene (re-attaches after a renderer switch). */
function useCursorRenderer({ live, players, countriesData, selectedCountryId, hintsRef }) {
  const liveRef = useRef({ players, countriesData, selectedCountryId });
  liveRef.current = { players, countriesData, selectedCountryId };
  useEffect(() => {
    if (!live) return undefined;
    const state = {
      group: new THREE.Group(),
      entries: new Map(),
      scene: null,
      last: 0,
      hints: createHintPool(hintsRef.current),
      featureData: null,
      features: new Map(),
      resolve: () => null,
    };
    state.group.name = "conquest-cursors";
    const detach = () => {
      state.entries.forEach(disposeEntry);
      state.entries.clear();
      state.group.parent?.remove(state.group);
      state.group.clear();
    };
    let raf = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const globe = getGlobe();
      const scene = globe?.scene?.();
      const camera = globe?.camera?.();
      const canvas = globe?.renderer?.()?.domElement;
      if (!scene || !camera || !canvas) return;
      if (state.scene !== scene) {
        detach();
        scene.add(state.group);
        state.scene = scene;
      }
      const cur = liveRef.current;
      if (state.featureData !== cur.countriesData) {
        state.featureData = cur.countriesData;
        const { index, resolve } = featureIndexOf(cur.countriesData);
        state.features = index;
        state.resolve = resolve;
      }
      const dt = state.last ? t - state.last : 16;
      state.last = t;
      updateFrame(
        state,
        {
          camera,
          canvas,
          players: cur.players || [],
          selfCountryId: cur.selectedCountryId || null,
          features: state.features,
          resolve: state.resolve,
        },
        dt
      );
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      detach();
      state.hints.dispose();
    };
  }, [live, hintsRef]);
}

/**
 * « Curseurs spatiaux » : each opponent appears as a small terminal cursor
 * floating above the point of the globe they look at, with the country they
 * selected outlined and tinted in their colour, linked to the cursor. When the
 * cursor is out of sight a square hint points at it from the screen edge.
 */
const ConquestCursorLayer = ({ conquest, countriesData, selectedCountryId }) => {
  const live = conquest?.match?.status === "live";
  const hintsRef = useRef(null);
  useCursorSender({
    live,
    userId: conquest?.userId,
    sendCursor: conquest?.sendCursor,
    selectedCountryId,
  });
  useCursorRenderer({
    live,
    players: conquest?.players,
    countriesData,
    selectedCountryId,
    hintsRef,
  });
  return <div ref={hintsRef} className="cq-hints" aria-hidden="true" />;
};

export default ConquestCursorLayer;
