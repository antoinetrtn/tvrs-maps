import React, { useEffect, useRef } from "react";

import { showToast, ToastViewport } from "../components/ui/Toast";
import GlobeMap from "./GlobeMap.jsx";
import { useGlobePrefs } from "./globePrefs";
import { resolveGlobeRenderer } from "./render/globeRendererFlag";

const RENDERER_LABEL = { webgl: "WebGL", webgpu: "WebGPU (expérimental)" };

/**
 * Mounts the globe for the chosen renderer. A renderer cannot be swapped on a
 * live three.js scene, so changing it in Settings remounts the globe (keyed
 * on the renderer) and frees the previous GPU context.
 */
const GlobeMapHost = (props) => {
  const prefs = useGlobePrefs();
  const renderer = resolveGlobeRenderer({ preference: prefs.renderer });
  const previous = useRef(renderer);

  useEffect(() => {
    if (previous.current === renderer) return undefined;
    previous.current = renderer;
    showToast({ message: `Globe : rendu ${RENDERER_LABEL[renderer]}`, tone: "success" });
    return undefined;
  }, [renderer]);

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

  return (
    <>
      <GlobeMap key={renderer} {...props} />
      <ToastViewport />
    </>
  );
};

export default GlobeMapHost;
