import React, { useEffect, useRef, useSyncExternalStore } from "react";

import { showToast } from "../components/ui/Toast";
import GlobeMap from "./GlobeMap.jsx";
import { useGlobePrefs } from "./globePrefs";
import {
  hasWebGPUSupport,
  resolveGlobeRenderer,
  wantedGlobeRenderer,
} from "./render/globeRendererFlag";
import { getWebGPUHealth, probeWebGPUAdapter, subscribeWebGPUHealth } from "./render/webgpuHealth";

const RENDERER_LABEL = { webgl: "WebGL", webgpu: "WebGPU" };

/**
 * Mounts the globe for the active renderer (WebGPU by default, WebGL
 * fallback). A renderer cannot be swapped on a live three.js scene, so a
 * change (Settings, no adapter, init failure, device lost) remounts the globe
 * (keyed on the renderer) and frees the previous GPU context.
 */
const GlobeMapHost = (props) => {
  const prefs = useGlobePrefs();
  const health = useSyncExternalStore(subscribeWebGPUHealth, getWebGPUHealth, getWebGPUHealth);
  const wanted = wantedGlobeRenderer({ preference: prefs.renderer });
  // WebGPU wanted but the adapter is not probed yet: wait (a few ms) rather
  // than mount a WebGPU globe that would immediately fall back.
  const probing = wanted === "webgpu" && hasWebGPUSupport() && health.adapter === "unknown";
  const renderer = resolveGlobeRenderer({ preference: prefs.renderer, health });
  const previous = useRef(probing ? null : renderer);

  useEffect(() => {
    if (probing) void probeWebGPUAdapter();
  }, [probing]);

  useEffect(() => {
    if (probing) return;
    if (previous.current === null) {
      previous.current = renderer;
      return;
    }
    if (previous.current === renderer) return;
    previous.current = renderer;
    const fellBack = renderer === "webgl" && wanted === "webgpu";
    showToast({
      message: fellBack
        ? "WebGPU indisponible : retour au rendu WebGL"
        : `Globe : rendu ${RENDERER_LABEL[renderer]}`,
      tone: fellBack ? "info" : "success",
    });
  }, [probing, renderer, wanted]);

  useEffect(
    () => () => {
      // Runs when this renderer's globe unmounts: release its GPU context.
      const old = window.__TVRS_GLOBE_EL__?.renderer?.();
      setTimeout(() => {
        old?.dispose?.();
      }, 0);
    },
    [renderer]
  );

  return !probing ? <GlobeMap key={renderer} {...props} /> : null;
};

export default GlobeMapHost;
