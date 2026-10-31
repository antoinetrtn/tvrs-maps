import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  createTileMesh,
  SATELLITE_TILE_MAX_LEVEL,
  SATELLITE_TILE_URL,
  tileLevelForAltitude,
  visibleTiles,
} from "../render/satelliteTiles";

const MAX_CONCURRENT_LOADS = 6;
const CAMERA_DEBOUNCE_MS = 150;
const SWAP_FALLBACK_TIMEOUT_MS = 1500;

function getMemoryLimits() {
  const isLowMemory =
    typeof navigator !== "undefined" &&
    typeof navigator.deviceMemory === "number" &&
    navigator.deviceMemory < 4;

  return {
    maxLevel: isLowMemory ? 6 : SATELLITE_TILE_MAX_LEVEL,
    maxCache: isLowMemory ? 48 : 96,
  };
}

function disposeTileEntry(entry) {
  if (!entry) {
    return;
  }
  try {
    entry.mesh?.geometry?.dispose();
    entry.texture?.dispose();
    entry.mesh?.material?.dispose();
  } catch {
    // Ignore teardown disposal errors
  }
}

class TileLruCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  peek(key) {
    return this.entries.get(key) || null;
  }

  has(key) {
    return this.entries.has(key);
  }

  set(key, entry) {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, entry);
  }

  prune(onEvict) {
    while (this.entries.size > this.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      const entry = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (entry && onEvict) {
        onEvict(oldestKey, entry);
      }
    }
  }

  clear(onEvict) {
    if (onEvict) {
      for (const [key, entry] of this.entries.entries()) {
        onEvict(key, entry);
      }
    }
    this.entries.clear();
  }
}

class SatelliteTileManager {
  constructor({ globeEl, createMaterial }) {
    this.globeEl = globeEl;
    this.createMaterial = createMaterial;

    const { maxLevel, maxCache } = getMemoryLimits();
    this.maxLevel = maxLevel;
    this.group = new THREE.Group();
    this.group.name = "satellite-tiles";

    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin("anonymous");

    this.cache = new TileLruCache(maxCache);
    this.displayedKeys = new Set();
    this.targetKeys = new Set();
    this.pendingKeys = new Set();
    this.queue = [];
    this.loadingKeys = new Set();
    this.activeLoads = 0;

    this.swapTimer = null;
    this.debounceTimer = null;
    this.rafId = null;
    this.controlsRef = null;
    this.isDisposed = false;

    this.onCameraChange = () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.updateFromCamera();
      }, CAMERA_DEBOUNCE_MS);
    };
  }

  init() {
    if (this.isDisposed) {
      return;
    }
    const instance = this.globeEl.current;
    if (!instance) {
      this.rafId = requestAnimationFrame(() => this.init());
      return;
    }
    const scene = instance.scene?.();
    const controls = instance.controls?.();
    if (!scene || !controls) {
      this.rafId = requestAnimationFrame(() => this.init());
      return;
    }

    scene.add(this.group);
    this.controlsRef = controls;
    controls.addEventListener("change", this.onCameraChange);
    this.updateFromCamera();
  }

  updateFromCamera() {
    if (this.isDisposed || !this.globeEl.current) {
      return;
    }
    const pov = this.globeEl.current.pointOfView?.();
    if (pov) {
      this.updateTiles(pov);
    }
  }

  updateTiles(pov) {
    const rawLevel = tileLevelForAltitude(pov.altitude);
    const level = Math.min(rawLevel, this.maxLevel);

    if (level === 0) {
      this.group.visible = false;
      this.clearSwapTimer();
      return;
    }

    this.group.visible = true;
    const visible = visibleTiles(pov, level);
    this.targetKeys = new Set(visible.map((t) => `${t.z}/${t.x}/${t.y}`));
    this.pendingKeys = new Set();
    const missingTiles = [];

    for (const tile of visible) {
      this.processVisibleTile(tile, missingTiles);
    }

    this.queue = this.queue.filter((item) => this.targetKeys.has(item.key));
    for (const tile of missingTiles) {
      this.queue.push({ tile, key: `${tile.z}/${tile.x}/${tile.y}` });
    }

    if (this.pendingKeys.size === 0) {
      this.performSwap();
      return;
    }
    this.scheduleSwapTimer();
    this.pumpQueue();
  }

  processVisibleTile(tile, missingTiles) {
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    if (this.cache.has(key)) {
      this.cache.get(key);
      return;
    }
    this.pendingKeys.add(key);
    if (!this.loadingKeys.has(key)) {
      this.loadingKeys.add(key);
      missingTiles.push(tile);
    }
  }

  clearSwapTimer() {
    if (this.swapTimer) {
      clearTimeout(this.swapTimer);
      this.swapTimer = null;
    }
  }

  scheduleSwapTimer() {
    if (this.swapTimer) {
      clearTimeout(this.swapTimer);
    }
    this.swapTimer = setTimeout(() => {
      this.performSwap();
    }, SWAP_FALLBACK_TIMEOUT_MS);
  }

  performSwap() {
    this.clearSwapTimer();
    for (const key of Array.from(this.displayedKeys)) {
      if (!this.targetKeys.has(key)) {
        const entry = this.cache.peek(key);
        if (entry?.mesh) {
          this.group.remove(entry.mesh);
        }
        this.displayedKeys.delete(key);
      }
    }
    for (const key of this.targetKeys) {
      if (!this.displayedKeys.has(key)) {
        const entry = this.cache.peek(key);
        if (entry?.mesh) {
          this.group.add(entry.mesh);
          this.displayedKeys.add(key);
        }
      }
    }
  }

  pumpQueue() {
    if (this.isDisposed) {
      return;
    }
    while (this.activeLoads < MAX_CONCURRENT_LOADS && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!this.targetKeys.has(item.key)) {
        this.loadingKeys.delete(item.key);
        continue;
      }
      this.activeLoads++;
      this.loadTile(item.tile, item.key);
    }
  }

  configureTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    const renderer = this.globeEl.current?.renderer?.();
    const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.();
    if (typeof maxAnisotropy === "number" && maxAnisotropy > 0) {
      texture.anisotropy = maxAnisotropy;
    }
  }

  loadTile(tile, key) {
    const url = SATELLITE_TILE_URL(tile.z, tile.x, tile.y);
    this.loader.load(
      url,
      (texture) => this.onTileSuccess(tile, key, texture),
      undefined,
      () => this.onTileFailure(key)
    );
  }

  onTileSuccess(tile, key, texture) {
    this.activeLoads--;
    this.loadingKeys.delete(key);
    if (this.isDisposed) {
      texture.dispose();
      return;
    }
    this.configureTexture(texture);

    const material = this.createMaterial ? this.createMaterial(texture) : undefined;
    const mesh = createTileMesh(tile, texture, material);
    const entry = { tile, texture, mesh };

    this.cache.set(key, entry);
    this.pruneCache();

    if (this.targetKeys.has(key)) {
      this.pendingKeys.delete(key);
      if (!this.swapTimer) {
        this.group.add(mesh);
        this.displayedKeys.add(key);
      } else if (this.pendingKeys.size === 0) {
        this.performSwap();
      }
    }
    this.pumpQueue();
  }

  onTileFailure(key) {
    this.activeLoads--;
    this.loadingKeys.delete(key);
    if (this.targetKeys.has(key)) {
      this.pendingKeys.delete(key);
      if (this.swapTimer && this.pendingKeys.size === 0) {
        this.performSwap();
      }
    }
    this.pumpQueue();
  }

  pruneCache() {
    this.cache.prune((evictedKey, evicted) => {
      if (this.displayedKeys.has(evictedKey)) {
        this.group.remove(evicted.mesh);
        this.displayedKeys.delete(evictedKey);
      }
      disposeTileEntry(evicted);
    });
  }

  destroy() {
    this.isDisposed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.clearSwapTimer();

    if (this.controlsRef) {
      this.controlsRef.removeEventListener("change", this.onCameraChange);
    }
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.group.clear();
    this.cache.clear((_k, entry) => disposeTileEntry(entry));
    this.displayedKeys.clear();
    this.targetKeys.clear();
    this.pendingKeys.clear();
    this.loadingKeys.clear();
    this.queue = [];
  }
}

export function useSatelliteTileLayer({ globeEl, enabled, createMaterial }) {
  const groupRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const manager = new SatelliteTileManager({ globeEl, createMaterial });
    groupRef.current = manager.group;
    manager.init();

    return () => {
      manager.destroy();
      groupRef.current = null;
    };
  }, [enabled, globeEl, createMaterial]);

  return { group: groupRef.current };
}
