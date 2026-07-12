import { useState, useEffect, useMemo } from "react";
import { countryDataMap } from "../gameData";
import { departmentsDataMap } from "../departmentsData";
import { riversMountainsDataMap } from "../riversMountainsData";
import { DATA_URLS } from "../gameConstants";

export function useGeoData({ mode }) {
  const [countriesData, setCountriesData] = useState([]);
  const [departmentsData, setDepartmentsData] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.countriesGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          setCountriesData(data.features);
        }
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
          setDepartmentsData(data.features);
        }
      })
      .catch((err) =>
        console.error("Failed to load departments map data", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const isDepartmentsMode = mode === "departments";
  const isRiversMountainsMode = mode === "rivers_mountains";

  const activeDataMap = useMemo(() => {
    if (isRiversMountainsMode) return riversMountainsDataMap;
    return isDepartmentsMode ? departmentsDataMap : countryDataMap;
  }, [isDepartmentsMode, isRiversMountainsMode]);

  const allCountryKeys = useMemo(
    () => Object.keys(activeDataMap),
    [activeDataMap],
  );
  const totalPossible = allCountryKeys.length;

  return {
    countriesData,
    departmentsData,
    activeDataMap,
    allCountryKeys,
    totalPossible,
  };
}
