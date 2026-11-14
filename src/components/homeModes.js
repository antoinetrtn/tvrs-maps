/** Clé de la carte Conquête dans le carrousel d'accueil (1re carte, ne lance pas une partie solo). */
export const HOME_CONQUEST_KEY = "conquest";

/** Mode de données du globe d'accueil : la carte Conquête affiche le globe monde par défaut. */
export const getHomeGeoMode = (homeMode) =>
  homeMode === HOME_CONQUEST_KEY ? "countries" : homeMode;

/** Sous-mode « données » du globe d'accueil (les capitales s'appuient sur les pays). */
export const getHomeLearnSubMode = (homeMode) => {
  const geoMode = getHomeGeoMode(homeMode);
  return geoMode === "capitals" ? "countries" : geoMode;
};

/** Datasets to *load* on the home screen. Follows the visible card immediately
 *  (not the settled globe layer) so regional GeoJSON is fetching/parsing during
 *  the carousel settle window and is ready when the crossfade starts. */
export function getHomeGeoRequest(homeMode) {
  return {
    mode: getHomeGeoMode(homeMode),
    learnSubMode: getHomeLearnSubMode(homeMode),
  };
}
