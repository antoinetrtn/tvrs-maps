import { useEffect, useMemo, useState } from "react";

import { DEFAULT_LEARN_SUB_MODE } from "../config/gameConfig";
import { DATA_URLS } from "../config/gameConstants";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
import { getRenderGeometry } from "../utils/utils";

export function useGeoData({ mode, learnSubMode = DEFAULT_LEARN_SUB_MODE }) {
  const [countriesData, setCountriesData] = useState([]);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [usStatesData, setUsStatesData] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.countriesGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          const mapped = data.features.map((feature) => ({
            ...feature,
            renderGeometry: getRenderGeometry(feature),
          }));
          setCountriesData(mapped);
        }
        return;
      })
      .catch((err) => console.error("Failed to load map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.departmentsGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          const mapped = data.features.map((feature) => ({
            ...feature,
            renderGeometry: getRenderGeometry(feature),
          }));
          setDepartmentsData(mapped);
        }
        return;
      })
      .catch((err) => console.error("Failed to load departments map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/us-states.json")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          const mapped = data.features.map((feature) => ({
            ...feature,
            renderGeometry: getRenderGeometry(feature),
          }));
          setUsStatesData(mapped);
        }
        return;
      })
      .catch((err) => console.error("Failed to load US states map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const isLearn = mode === "learn";
  const isDepartmentsMode = mode === "departments" || (isLearn && learnSubMode === "departments");
  const isRiversMountainsMode =
    mode === "rivers_mountains" || (isLearn && learnSubMode === "rivers_mountains");
  const isUsStatesMode = mode === "us_states" || (isLearn && learnSubMode === "us_states");

  const activeDataMap = useMemo(() => {
    if (isRiversMountainsMode) return riversMountainsDataMap;
    if (isDepartmentsMode) return departmentsDataMap;
    if (isUsStatesMode) return usStatesDataMap;
    return countryDataMap;
  }, [isDepartmentsMode, isRiversMountainsMode, isUsStatesMode]);

  const allCountryKeys = useMemo(() => Object.keys(activeDataMap), [activeDataMap]);
  const totalPossible = allCountryKeys.length;

  return {
    countriesData,
    departmentsData,
    usStatesData,
    activeDataMap,
    allCountryKeys,
    totalPossible,
  };
}
