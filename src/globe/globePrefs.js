/**
 * Globe display preferences that live outside React props: the renderer
 * (WebGPU by default / WebGL). A tiny external
 * store so the settings sheet, the globe host and the polygon hook share them
 * without threading props through App.
 */
import { useSyncExternalStore } from "react";

export const GLOBE_PREF_KEYS = {
  renderer: "tvrs-globe-renderer",
};
const ALLOWED = {
  renderer: ["webgl", "webgpu"],
};
// renderer: null = no choice yet (VITE_GLOBE_RENDERER, then WebGPU when usable).
const DEFAULTS = { renderer: null };

function readStored(name) {
  try {
    const value = globalThis.localStorage?.getItem(GLOBE_PREF_KEYS[name]);
    return ALLOWED[name].includes(value) ? value : DEFAULTS[name];
  } catch {
    return DEFAULTS[name];
  }
}

// Held on globalThis: in dev, Vite pre-bundles a second copy of this module
// inside the globe.gl deps (via the three-render-objects shim) and both copies
// must see the same choice.
const holder = (globalThis.__TVRS_GLOBE_PREFS__ ||= {
  state: { renderer: readStored("renderer") },
});
const listeners = new Set();

export function getGlobePrefs() {
  return holder.state;
}

export function setGlobePref(name, value) {
  if (!ALLOWED[name]?.includes(value) || holder.state[name] === value) return;
  holder.state = { ...holder.state, [name]: value };
  try {
    globalThis.localStorage?.setItem(GLOBE_PREF_KEYS[name], value);
  } catch {
    // Private mode: keep the in-memory value.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGlobePrefs() {
  return useSyncExternalStore(subscribe, getGlobePrefs, getGlobePrefs);
}
