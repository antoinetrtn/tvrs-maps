/**
 * Read-only probe for Playwright / unit tests. Always published (tiny) so
 * iPhone-viewport e2e can assert home-card camera flies start immediately,
 * retarget without a snap, and progress monotonically toward the target.
 */
function getStore() {
  if (typeof globalThis === "undefined") {
    return { target: null, durationMs: 0, startedAt: 0, getCurrent: () => null };
  }
  return (globalThis.__TVRS_CAMERA_TEST__ ||= {
    target: null,
    durationMs: 0,
    startedAt: 0,
    flights: [],
    getCurrent: () => null,
  });
}

export function bindCameraTestGlobe(globe) {
  const store = getStore();
  store.getCurrent = () => {
    try {
      return globe?.pointOfView?.() || null;
    } catch {
      return null;
    }
  };
  store.getGlobe = () => globe || null;
}

export function publishCameraFly(target, durationMs) {
  const store = getStore();
  store.target = target || null;
  store.durationMs = Number.isFinite(durationMs) ? durationMs : 0;
  store.startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  store.flights = [
    ...(store.flights || []),
    {
      target: store.target,
      durationMs: store.durationMs,
      startedAt: store.startedAt,
    },
  ].slice(-12);
}
