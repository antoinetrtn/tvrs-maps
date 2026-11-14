/**
 * Read-only probe for Playwright / unit tests. Always published (tiny) so
 * iPhone-viewport e2e can assert that the active regional layer is actually
 * drawn and that the mode crossfade progresses 0→1.
 */
const emptyVisible = { departments: 0, us: 0, world: 0, dormant: 0 };

function getStore() {
  if (typeof globalThis === "undefined") return { visible: { ...emptyVisible } };
  return (globalThis.__TVRS_LAYER_TEST__ ||= {
    effectiveMode: "world",
    transitionLive: false,
    transitionProgress: 0,
    counts: { dormant: 0, departmentsActive: 0, usActive: 0, world: 0 },
    visible: { ...emptyVisible },
  });
}

export function publishLayerTestState(partial) {
  Object.assign(getStore(), partial);
}

export function publishLayerTestVisible(visible) {
  getStore().visible = { ...emptyVisible, ...visible };
}
