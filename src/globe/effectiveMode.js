import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { usStatesDataMap } from "../data/usStatesData";

const REGIONAL = new Set(["departments", "us_states"]);

/** Mode/data map of the layer actually on screen (a regional layer only once its data is ready). */
export function resolveEffectiveMode({
  mode,
  gameDataMap,
  effectiveDepartmentMode,
  effectiveUsStatesMode,
}) {
  if (effectiveDepartmentMode)
    return { effectiveMode: "departments", effectiveGameDataMap: departmentsDataMap };
  if (effectiveUsStatesMode)
    return { effectiveMode: "us_states", effectiveGameDataMap: usStatesDataMap };
  if (REGIONAL.has(mode))
    return { effectiveMode: "countries", effectiveGameDataMap: countryDataMap };
  return { effectiveMode: mode, effectiveGameDataMap: gameDataMap };
}
