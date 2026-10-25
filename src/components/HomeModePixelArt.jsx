import React from "react";

import { MODE_PIXEL_PALETTES, PIXEL_SCENE_SWATCHES as S } from "../config/accentPresets";

const ConquestPixelScene = () => (
  <>
    <rect x="0" y="0" width="36" height="28" fill={S.bgArenaOuter} />
    <rect x="1" y="1" width="34" height="26" fill={S.bgArenaInner} />
    <rect x="1" y="13" width="34" height="1" fill={S.gridSlate} />
    <rect x="17" y="1" width="1" height="26" fill={S.gridSlate} />
    <rect x="3" y="16" width="11" height="6" fill={S.amber900} />
    <rect x="4" y="15" width="9" height="6" fill={S.amber700} />
    <rect x="5" y="16" width="7" height="4" fill={S.amber500} />
    <rect x="7" y="17" width="2" height="2" fill={S.yellow100} />
    <rect x="22" y="16" width="11" height="6" fill={S.teal900} />
    <rect x="23" y="15" width="9" height="6" fill={S.teal600} />
    <rect x="24" y="16" width="7" height="4" fill={S.teal400} />
    <rect x="27" y="17" width="2" height="2" fill={S.teal100} />
    <rect x="8" y="6" width="2" height="2" fill={S.ice100} />
    <rect x="10" y="8" width="2" height="2" fill={S.ice100} />
    <rect x="12" y="10" width="2" height="2" fill={S.ice200} />
    <rect x="14" y="12" width="2" height="2" fill={S.amber500} />
    <rect x="26" y="6" width="2" height="2" fill={S.ice100} />
    <rect x="24" y="8" width="2" height="2" fill={S.ice100} />
    <rect x="22" y="10" width="2" height="2" fill={S.ice200} />
    <rect x="20" y="12" width="2" height="2" fill={S.teal400} />
    <rect x="16" y="9" width="4" height="4" fill={S.amber500} />
    <rect x="17" y="7" width="2" height="8" fill={S.yellow200} />
    <rect x="14" y="10" width="8" height="2" fill={S.yellow200} />
    <rect x="17" y="10" width="2" height="2" fill={S.white} />
    <rect x="4" y="4" width="2" height="2" fill={S.amber400} />
    <rect x="30" y="4" width="2" height="2" fill={S.teal400} />
    <rect x="17" y="3" width="2" height="1" fill={S.yellow100} />
  </>
);

const CountriesPixelScene = () => (
  <>
    <rect x="0" y="0" width="36" height="28" fill={S.bgCountriesOuter} />
    <rect x="1" y="1" width="34" height="26" fill={S.bgCountriesInner} />
    <rect x="3" y="4" width="1" height="1" fill={S.yellow200} />
    <rect x="31" y="5" width="2" height="2" fill={S.yellow100} />
    <rect x="5" y="22" width="1" height="1" fill={S.mutedSlate} />
    <rect x="30" y="21" width="1" height="1" fill={S.sky400} />
    <rect x="12" y="4" width="12" height="20" fill={S.oceanDeep} />
    <rect x="9" y="6" width="18" height="16" fill={S.oceanDeep} />
    <rect x="8" y="8" width="20" height="12" fill={S.oceanMid} />
    <rect x="10" y="8" width="5" height="5" fill={S.amber700} />
    <rect x="11" y="9" width="4" height="3" fill={S.amber600} />
    <rect x="12" y="14" width="4" height="5" fill={S.amber800} />
    <rect x="18" y="7" width="7" height="6" fill={S.amber700} />
    <rect x="19" y="8" width="5" height="4" fill={S.amber500} />
    <rect x="19" y="13" width="5" height="6" fill={S.amber700} />
    <rect x="20" y="14" width="3" height="4" fill={S.amber600} />
    <rect x="12" y="10" width="1" height="1" fill={S.yellow100} />
    <rect x="19" y="9" width="2" height="2" fill={S.yellow50} />
    <rect x="22" y="10" width="1" height="1" fill={S.yellow200} />
    <rect x="20" y="15" width="1" height="1" fill={S.yellow200} />
    <rect x="7" y="13" width="2" height="1" fill={S.sky400} />
    <rect x="27" y="13" width="2" height="1" fill={S.sky400} />
  </>
);

const CapitalsPixelScene = () => (
  <>
    <rect x="0" y="0" width="36" height="28" fill={S.bgCapitalsOuter} />
    <rect x="1" y="1" width="34" height="26" fill={S.bgCapitalsInner} />
    <rect x="4" y="4" width="1" height="1" fill={S.yellow100} />
    <rect x="29" y="4" width="2" height="2" fill={S.yellow200} />
    <rect x="8" y="8" width="1" height="1" fill={S.amber400} />
    <rect x="26" y="9" width="1" height="1" fill={S.amber400} />
    <rect x="3" y="21" width="30" height="4" fill={S.earthDark} />
    <rect x="4" y="22" width="28" height="2" fill={S.earthMid} />
    <rect x="6" y="22" width="6" height="1" fill={S.amber600} />
    <rect x="24" y="22" width="6" height="1" fill={S.amber600} />
    <rect x="11" y="20" width="14" height="2" fill={S.amber500} />
    <rect x="7" y="16" width="4" height="5" fill={S.gridSlate} />
    <rect x="8" y="17" width="1" height="1" fill={S.yellow200} />
    <rect x="8" y="19" width="2" height="1" fill={S.amber500} />
    <rect x="25" y="15" width="4" height="6" fill={S.gridSlate} />
    <rect x="26" y="16" width="2" height="1" fill={S.yellow200} />
    <rect x="27" y="18" width="1" height="2" fill={S.amber500} />
    <rect x="14" y="15" width="8" height="6" fill={S.amber800} />
    <rect x="15" y="12" width="6" height="9" fill={S.amber600} />
    <rect x="16" y="9" width="4" height="12" fill={S.amber500} />
    <rect x="17" y="5" width="2" height="16" fill={S.yellow200} />
    <rect x="15" y="6" width="6" height="2" fill={S.yellow100} />
    <rect x="17" y="4" width="2" height="6" fill={S.white} />
  </>
);

const DepartmentsPixelScene = () => (
  <>
    <rect x="0" y="0" width="36" height="28" fill={S.bgDeptsOuter} />
    <rect x="1" y="1" width="34" height="26" fill={S.bgDeptsInner} />
    <rect x="3" y="3" width="2" height="2" fill={S.blue500} />
    <rect x="5" y="3" width="2" height="2" fill={S.ice100} />
    <rect x="7" y="3" width="2" height="2" fill={S.red500} />
    <rect x="15" y="4" width="5" height="4" fill={S.blue600} />
    <rect x="9" y="8" width="7" height="4" fill={S.blue500} />
    <rect x="16" y="8" width="6" height="6" fill={S.amber600} />
    <rect x="17" y="9" width="4" height="4" fill={S.amber500} />
    <rect x="22" y="7" width="5" height="7" fill={S.red600} />
    <rect x="21" y="14" width="6" height="6" fill={S.orange600} />
    <rect x="11" y="12" width="5" height="6" fill={S.blue700} />
    <rect x="12" y="18" width="9" height="5" fill={S.amber700} />
    <rect x="13" y="19" width="7" height="3" fill={S.amber500} />
    <rect x="14" y="13" width="5" height="1" fill={S.sky400} />
    <rect x="21" y="14" width="1" height="6" fill={S.sky400} />
    <rect x="18" y="9" width="2" height="2" fill={S.white} />
    <rect x="17" y="10" width="4" height="1" fill={S.yellow100} />
    <rect x="29" y="20" width="2" height="4" fill={S.amber500} />
  </>
);

const UsStatesPixelScene = () => (
  <>
    <rect x="0" y="0" width="36" height="28" fill={S.bgUsOuter} />
    <rect x="1" y="1" width="34" height="26" fill={S.bgUsInner} />
    <rect x="4" y="4" width="2" height="2" fill={S.yellow100} />
    <rect x="8" y="4" width="2" height="2" fill={S.sky400} />
    <rect x="30" y="4" width="2" height="2" fill={S.orange400} />
    <rect x="5" y="9" width="7" height="11" fill={S.orange700} />
    <rect x="6" y="10" width="5" height="9" fill={S.orange400} />
    <rect x="12" y="10" width="9" height="10" fill={S.amber700} />
    <rect x="13" y="11" width="7" height="8" fill={S.amber500} />
    <rect x="14" y="20" width="5" height="3" fill={S.amber600} />
    <rect x="21" y="10" width="8" height="9" fill={S.blue700} />
    <rect x="22" y="11" width="6" height="7" fill={S.sky400} />
    <rect x="28" y="8" width="3" height="4" fill={S.blue400} />
    <rect x="25" y="19" width="3" height="4" fill={S.blue600} />
    <rect x="20" y="11" width="1" height="9" fill={S.cyan300} />
    <rect x="7" y="14" width="2" height="2" fill={S.yellow100} />
    <rect x="16" y="19" width="2" height="2" fill={S.yellow100} />
    <rect x="26" y="12" width="2" height="2" fill={S.white} />
  </>
);

const RiversMountainsPixelScene = () => (
  <>
    <rect x="0" y="0" width="36" height="28" fill={S.bgRiversOuter} />
    <rect x="1" y="1" width="34" height="26" fill={S.bgRiversInner} />
    <rect x="5" y="4" width="2" height="2" fill={S.yellow100} />
    <rect x="29" y="5" width="1" height="1" fill={S.cyan200} />
    <rect x="15" y="3" width="1" height="1" fill={S.yellow200} />
    <rect x="4" y="16" width="14" height="7" fill={S.earthMid} />
    <rect x="6" y="13" width="10" height="4" fill={S.slopeMid} />
    <rect x="8" y="10" width="6" height="3" fill={S.slopeOchre} />
    <rect x="9" y="8" width="4" height="2" fill={S.ice100} />
    <rect x="10" y="7" width="2" height="1" fill={S.white} />
    <rect x="15" y="15" width="17" height="8" fill={S.slopeDark} />
    <rect x="17" y="11" width="13" height="4" fill={S.slopeWarm} />
    <rect x="19" y="8" width="9" height="3" fill={S.slopeGold} />
    <rect x="20" y="6" width="7" height="2" fill={S.iceSky} />
    <rect x="21" y="4" width="5" height="2" fill={S.white} />
    <rect x="2" y="22" width="32" height="5" fill={S.oceanDark} />
    <rect x="15" y="15" width="3" height="3" fill={S.cyan500} />
    <rect x="13" y="18" width="5" height="3" fill={S.cyan600} />
    <rect x="14" y="18" width="3" height="3" fill={S.cyan400} />
    <rect x="10" y="21" width="9" height="3" fill={S.cyan500} />
    <rect x="12" y="21" width="5" height="2" fill={S.cyan300} />
    <rect x="7" y="24" width="15" height="3" fill={S.cyan400} />
    <rect x="10" y="25" width="9" height="1" fill={S.cyan100} />
  </>
);

const SCENE_BY_MODE = {
  conquest: ConquestPixelScene,
  countries: CountriesPixelScene,
  capitals: CapitalsPixelScene,
  departments: DepartmentsPixelScene,
  us_states: UsStatesPixelScene,
  rivers_mountains: RiversMountainsPixelScene,
};

export const HomeModePixelArt = ({ modeKey }) => {
  const Scene = SCENE_BY_MODE[modeKey] || CountriesPixelScene;
  const palette = MODE_PIXEL_PALETTES[modeKey] || MODE_PIXEL_PALETTES.countries;

  return (
    <svg
      className="card-pixel-art-svg"
      viewBox="0 0 36 28"
      width="56"
      height="44"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <Scene />
      <rect x="0" y="0" width="36" height="1" fill={palette.primary} fillOpacity="0.65" />
      <rect x="0" y="27" width="36" height="1" fill={palette.primary} fillOpacity="0.65" />
      <rect x="0" y="0" width="1" height="28" fill={palette.primary} fillOpacity="0.65" />
      <rect x="35" y="0" width="1" height="28" fill={palette.primary} fillOpacity="0.65" />
      <rect x="0" y="0" width="2" height="2" fill={palette.spark} />
      <rect x="34" y="0" width="2" height="2" fill={palette.spark} />
      <rect x="0" y="26" width="2" height="2" fill={palette.secondary} />
      <rect x="34" y="26" width="2" height="2" fill={palette.secondary} />
    </svg>
  );
};

export const CardPixelOrnaments = ({ modeKey }) => {
  const palette = MODE_PIXEL_PALETTES[modeKey] || MODE_PIXEL_PALETTES.countries;

  return (
    <div className="card-pixel-ornaments" aria-hidden="true">
      <svg
        className="card-corner-ornament corner-tl"
        viewBox="0 0 18 18"
        shapeRendering="crispEdges"
      >
        <rect x="8" y="0" width="10" height="2" fill={palette.primary} />
        <rect x="4" y="2" width="4" height="2" fill={palette.primary} />
        <rect x="2" y="4" width="2" height="4" fill={palette.primary} />
        <rect x="0" y="8" width="2" height="10" fill={palette.primary} />
        <rect x="6" y="6" width="3" height="3" fill={palette.spark} />
        <rect x="11" y="4" width="2" height="2" fill={palette.secondary} />
        <rect x="4" y="11" width="2" height="2" fill={palette.secondary} />
      </svg>

      <svg
        className="card-corner-ornament corner-tr"
        viewBox="0 0 18 18"
        shapeRendering="crispEdges"
      >
        <rect x="0" y="0" width="10" height="2" fill={palette.primary} />
        <rect x="10" y="2" width="4" height="2" fill={palette.primary} />
        <rect x="14" y="4" width="2" height="4" fill={palette.primary} />
        <rect x="16" y="8" width="2" height="10" fill={palette.primary} />
        <rect x="9" y="6" width="3" height="3" fill={palette.spark} />
        <rect x="5" y="4" width="2" height="2" fill={palette.secondary} />
        <rect x="12" y="11" width="2" height="2" fill={palette.secondary} />
      </svg>

      <svg
        className="card-corner-ornament corner-bl"
        viewBox="0 0 18 18"
        shapeRendering="crispEdges"
      >
        <rect x="0" y="0" width="2" height="10" fill={palette.primary} />
        <rect x="2" y="10" width="2" height="4" fill={palette.primary} />
        <rect x="4" y="14" width="4" height="2" fill={palette.primary} />
        <rect x="8" y="16" width="10" height="2" fill={palette.primary} />
        <rect x="6" y="9" width="3" height="3" fill={palette.secondary} />
      </svg>

      <svg
        className="card-corner-ornament corner-br"
        viewBox="0 0 18 18"
        shapeRendering="crispEdges"
      >
        <rect x="16" y="0" width="2" height="10" fill={palette.primary} />
        <rect x="14" y="10" width="2" height="4" fill={palette.primary} />
        <rect x="10" y="14" width="4" height="2" fill={palette.primary} />
        <rect x="0" y="16" width="10" height="2" fill={palette.primary} />
        <rect x="9" y="9" width="3" height="3" fill={palette.secondary} />
      </svg>

      <svg className="card-edge-crest crest-top" viewBox="0 0 64 8" shapeRendering="crispEdges">
        <rect x="0" y="0" width="18" height="2" fill={palette.primary} fillOpacity="0.55" />
        <rect x="20" y="2" width="6" height="2" fill={palette.secondary} />
        <rect x="28" y="0" width="8" height="3" fill={palette.spark} />
        <rect x="31" y="3" width="2" height="3" fill={palette.spark} />
        <rect x="38" y="2" width="6" height="2" fill={palette.secondary} />
        <rect x="46" y="0" width="18" height="2" fill={palette.primary} fillOpacity="0.55" />
      </svg>
    </div>
  );
};
