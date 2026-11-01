import { useMemo } from "react";

import { BREAKPOINTS, PERFORMANCE } from "../config/gameConstants";

/** Réglages de rendu du globe selon la largeur du viewport (mobile / tablette / desktop). */
export function usePerfProfile(viewportWidth) {
  return useMemo(() => {
    const isMobile = viewportWidth < BREAKPOINTS.mobile;
    const isTablet = viewportWidth >= BREAKPOINTS.mobile && viewportWidth < BREAKPOINTS.desktop;
    let tier = "desktop";
    if (isMobile) {
      tier = "mobile";
    } else if (isTablet) {
      tier = "tablet";
    }
    const devicePixelRatio = window.devicePixelRatio || 1;
    const pixelRatio = Math.min(devicePixelRatio, PERFORMANCE.maxPixelRatio[tier]);
    return {
      isMobile,
      isTablet,
      pixelRatio,
      antialias: !isMobile,
      enableAutoRotate: true,
      // Master switch only: GlobeMap still turns the hover raycast off wherever no
      // click handler needs it (see globe/render/pointerRaycast.js).
      enablePointerInteraction: true,
      maxLabels: PERFORMANCE.maxLabels[tier],
      showAtmosphere: true,
      useImageTextures: false,
      cullOffscreenCountries: isMobile,
      polygonCapCurvatureResolution: PERFORMANCE.polygonCapCurvatureResolution[tier],
    };
  }, [viewportWidth]);
}
