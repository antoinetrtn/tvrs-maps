export const HOME_DESKTOP_LAT = 16;
export const HOME_DESKTOP_LNG = 28;
export const HOME_DESKTOP_ALT_MIN = 1.45;
export const HOME_DESKTOP_ALT_MAX = 1.9;

const HOME_MIN_ASPECT = 1.2;
const HOME_MAX_ASPECT = 2.0;

/**
 * Computes home desktop POV with altitude tuned to viewport aspect ratio.
 * Wider viewport -> lower altitude (sphere disc margins well preserved).
 *
 * @param {{ width?: number, height?: number }} [viewport]
 * @returns {{ lat: number, lng: number, altitude: number }}
 */
export function getHomeDesktopPov(viewport) {
  const width = viewport?.width ?? 1440;
  const height = viewport?.height ?? 900;
  const aspect = height > 0 ? width / height : 1.6;

  const t = Math.max(
    0,
    Math.min(1, (aspect - HOME_MIN_ASPECT) / (HOME_MAX_ASPECT - HOME_MIN_ASPECT))
  );
  const rawAltitude = HOME_DESKTOP_ALT_MAX - t * (HOME_DESKTOP_ALT_MAX - HOME_DESKTOP_ALT_MIN);
  const clampedAltitude = Math.max(
    HOME_DESKTOP_ALT_MIN,
    Math.min(HOME_DESKTOP_ALT_MAX, rawAltitude)
  );

  return {
    lat: HOME_DESKTOP_LAT,
    lng: HOME_DESKTOP_LNG,
    altitude: Math.round(clampedAltitude * 1000) / 1000,
  };
}
