/**
 * Observe-only counters for homepage mode-switch Playwright runs.
 * Always published (tiny). Does not change rendering.
 */
function emptyRenderer() {
  return { programs: 0, textures: 0, geometries: 0, calls: 0, triangles: 0 };
}

function readRenderer(globe) {
  try {
    const info = globe?.renderer?.()?.info;
    if (!info) return emptyRenderer();
    return {
      programs: info.programs?.length ?? 0,
      textures: info.memory?.textures ?? 0,
      geometries: info.memory?.geometries ?? 0,
      calls: info.render?.calls ?? 0,
      triangles: info.render?.triangles ?? 0,
    };
  } catch {
    return emptyRenderer();
  }
}

function getStore() {
  if (typeof globalThis === "undefined") {
    return { running: false, renders: 0, materialNeedsUpdate: 0, geometryBuilds: 0 };
  }
  return (globalThis.__TVRS_SWITCH_TRACE__ ||= {
    running: false,
    renders: 0,
    materialNeedsUpdate: 0,
    geometryBuilds: 0,
    start: null,
    end: null,
    delta: null,
    startTrace: null,
    endTrace: null,
  });
}

function startSwitchTrace(globe) {
  const store = getStore();
  store.running = true;
  store.renders = 0;
  store.materialNeedsUpdate = 0;
  store.geometryBuilds = 0;
  store.globe = globe || store.globe || null;
  store.start = {
    t: typeof performance !== "undefined" ? performance.now() : Date.now(),
    ...readRenderer(store.globe),
  };
  store.end = null;
  store.delta = null;
  return store.start;
}

export function bindSwitchTraceGlobe(globe) {
  const store = getStore();
  store.globe = globe || store.globe;
}

export function noteGlobeMapRender() {
  const store = getStore();
  if (store.running) store.renders += 1;
}

export function noteMaterialNeedsUpdate() {
  const store = getStore();
  if (store.running) store.materialNeedsUpdate += 1;
}

export function noteGeometryBuild() {
  const store = getStore();
  if (store.running) store.geometryBuilds += 1;
}

function endSwitchTrace() {
  const store = getStore();
  store.running = false;
  const end = {
    t: typeof performance !== "undefined" ? performance.now() : Date.now(),
    ...readRenderer(store.globe),
    renders: store.renders,
    materialNeedsUpdate: store.materialNeedsUpdate,
    geometryBuilds: store.geometryBuilds,
  };
  store.end = end;
  const start = store.start || { t: end.t, ...emptyRenderer() };
  store.delta = {
    ms: end.t - start.t,
    programs: end.programs - (start.programs || 0),
    textures: end.textures - (start.textures || 0),
    geometries: end.geometries - (start.geometries || 0),
    renders: store.renders,
    materialNeedsUpdate: store.materialNeedsUpdate,
    geometryBuilds: store.geometryBuilds,
  };
  return { start, end, delta: store.delta };
}

const store = typeof globalThis !== "undefined" ? getStore() : null;
if (store) {
  store.startTrace = () => startSwitchTrace(store.globe);
  store.endTrace = () => endSwitchTrace();
}
