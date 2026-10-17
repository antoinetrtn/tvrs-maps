import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_LEARN_SUB_MODE } from "../config/gameConfig";
import { DATA_URLS } from "../config/gameConstants";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
import { transformCountries, transformDepartments, transformUsStates } from "./geoDataTransforms";
import { useGeoResource } from "./useGeoResource";

// Stable `__id` stamps: three-globe keys its polygon meshes by `polygon.__id`
// (and stamps a random one otherwise). Every render-data wrapper spreads the
// source feature, so the id survives mode switches and the existing meshes,
// triangulated geometries and strokes are reused instead of rebuilt.
const REGIONAL_PREFETCH_DELAY_MS = 6000;

/** True once the page has been idle for `delayMs` after mount. */
function useIdleAfter(delayMs) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let idleId = null;
    const timer = setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      } else {
        setReady(true);
      }
    }, delayMs);
    return () => {
      clearTimeout(timer);
      if (idleId != null) window.cancelIdleCallback?.(idleId);
    };
  }, [delayMs]);
  return ready;
}

export function useGeoData({ mode, learnSubMode = DEFAULT_LEARN_SUB_MODE }) {
  const isLearn = mode === "learn";
  const isDepartmentsMode = mode === "departments" || (isLearn && learnSubMode === "departments");
  const isRiversMountainsMode =
    mode === "rivers_mountains" || (isLearn && learnSubMode === "rivers_mountains");
  const isUsStatesMode = mode === "us_states" || (isLearn && learnSubMode === "us_states");

  // Regional maps (≈1 MB of GeoJSON, parsed and triangulated on the main
  // thread) are no longer loaded at startup: they load when their mode opens,
  // or once the browser is idle a few seconds after start, whichever comes first.
  const idleRegional = useIdleAfter(REGIONAL_PREFETCH_DELAY_MS);
  const wantDepartments = isDepartmentsMode || idleRegional;
  const wantUsStates = isUsStatesMode || idleRegional;

  const countriesResource = useGeoResource({
    url: DATA_URLS.countriesGeoJson,
    enabled: true,
    transform: transformCountries,
  });

  const departmentsResource = useGeoResource({
    url: DATA_URLS.departmentsGeoJson,
    enabled: wantDepartments,
    transform: transformDepartments,
  });

  const usStatesResource = useGeoResource({
    url: "/data/us-states.json",
    enabled: wantUsStates,
    transform: transformUsStates,
  });

  const required = useMemo(() => {
    const list = [{ id: "countries", res: countriesResource }];
    if (isDepartmentsMode) {
      list.push({ id: "departments", res: departmentsResource });
    }
    if (isUsStatesMode) {
      list.push({ id: "usStates", res: usStatesResource });
    }
    return list;
  }, [countriesResource, departmentsResource, usStatesResource, isDepartmentsMode, isUsStatesMode]);

  const failed = useMemo(
    () => required.filter(({ res }) => res.status === "error").map(({ id }) => id),
    [required]
  );

  const status = useMemo(() => {
    if (failed.length > 0) return "error";
    if (required.some(({ res }) => res.status === "loading" || res.status === "idle")) {
      return "loading";
    }
    return "ready";
  }, [failed, required]);

  const requiredRef = useRef(required);
  requiredRef.current = required;

  const retry = useCallback(() => {
    requiredRef.current.forEach(({ res }) => {
      if (res.status === "error") {
        res.retry();
      }
    });
  }, []);

  const geoStatus = useMemo(
    () => ({
      status,
      failed,
      retry,
    }),
    [status, failed, retry]
  );

  const activeDataMap = useMemo(() => {
    if (isRiversMountainsMode) return riversMountainsDataMap;
    if (isDepartmentsMode) return departmentsDataMap;
    if (isUsStatesMode) return usStatesDataMap;
    return countryDataMap;
  }, [isDepartmentsMode, isRiversMountainsMode, isUsStatesMode]);

  const allCountryKeys = useMemo(() => Object.keys(activeDataMap), [activeDataMap]);
  const totalPossible = allCountryKeys.length;

  return {
    countriesData: countriesResource.data,
    departmentsData: departmentsResource.data,
    usStatesData: usStatesResource.data,
    activeDataMap,
    allCountryKeys,
    totalPossible,
    geoStatus,
  };
}
