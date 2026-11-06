import { useCallback, useEffect, useState } from "react";

function dismissBootOverlay(bootEl) {
  if (!bootEl) {
    return;
  }
  bootEl.classList.add("tvrs-boot-done");
  const onEnd = () => {
    bootEl.remove();
  };
  bootEl.addEventListener("transitionend", onEnd, { once: true });
  setTimeout(onEnd, 300);
}

function clearRootBusy(rootEl) {
  if (rootEl) {
    rootEl.removeAttribute("aria-busy");
  }
}

/**
 * useBootGate — Coordinates initial boot readiness between geo data and 3D globe.
 *
 * Boot gate stays active until BOTH:
 *   1. Geo data status is "ready" (countries GeoJSON fetched and processed)
 *   2. Globe has fired onGlobeReady (Three.js renderer and scene initialized)
 *
 * If geo data errors out, the overlay yields immediately to reveal the blocking ErrorState.
 */
export function useBootGate({ geoStatus }) {
  const [globeReady, setGlobeReady] = useState(false);
  const [bootDismissed, setBootDismissed] = useState(false);

  const onGlobeReady = useCallback(() => {
    setGlobeReady(true);
  }, []);

  const isGeoReady = geoStatus?.status === "ready";
  const hasGeoError = geoStatus?.status === "error";
  const isReady = isGeoReady && globeReady;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const bootEl = document.getElementById("tvrs-boot");
    const rootEl = document.getElementById("root");

    if (hasGeoError) {
      dismissBootOverlay(bootEl);
      clearRootBusy(rootEl);
      return;
    }

    if (isReady && !bootDismissed) {
      dismissBootOverlay(bootEl);
      clearRootBusy(rootEl);
      setBootDismissed(true);
    }
  }, [isReady, hasGeoError, bootDismissed]);

  return {
    isBootReady: bootDismissed || isReady,
    isGlobeReady: globeReady,
    onGlobeReady,
  };
}
