import React from "react";

import { createSatelliteTileMaterial } from "./hooks/useGlobeMaterial";
import { useSatelliteTileLayer } from "./hooks/useSatelliteTileLayer";

/**
 * Progressive satellite tiles (satellite theme only) + the NASA GIBS
 * acknowledgement they require. Renders nothing in the other themes.
 */
const SatelliteImageryLayer = ({ globeEl, globeTheme }) => {
  const enabled = globeTheme === "satellite";
  useSatelliteTileLayer({ globeEl, enabled, createMaterial: createSatelliteTileMaterial });
  if (!enabled) return null;
  return (
    <a
      className="globe-imagery-credit"
      href="https://www.earthdata.nasa.gov/gibs"
      target="_blank"
      rel="noopener noreferrer"
    >
      Imagerie : NASA GIBS (ESDIS) · Blue Marble
    </a>
  );
};

export default SatelliteImageryLayer;
