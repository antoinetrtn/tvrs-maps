import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobePolygons } from "../../globe/hooks/useGlobePolygons";
import { MODE_TRANSITION_MS } from "../../globe/render/modeTransition";
import {
  CONQUEST_OVERLAY_FIXTURE,
  createHookProps,
  FEATURE_BRAZIL,
  FEATURE_DEPT_AIN,
  FEATURE_FRANCE,
  FEATURE_JAPAN,
  FEATURE_RIVER_AMAZON,
  FEATURE_SPAIN,
  FEATURE_US_CALIFORNIA,
  resetGlobePolygonTestGlobals,
  summarizeFeatureOutput,
} from "./testHelpers";

function compactRow(hookCurrent, feature) {
  const s = summarizeFeatureOutput(hookCurrent, feature);
  const cap = s.capMaterial;
  const side = s.sideMaterial;
  const u = cap.uniforms;
  return {
    admin: s.admin,
    colors: `${s.color} | side:${s.sideColor} | stroke:${s.stroke} | base:${s.baseCapColor}/${s.baseSideColor}`,
    metrics: `alt:${s.altitude} | w:${s.strokeWidth} | res:${s.curvatureResolution}`,
    capMat: `${cap.type} vis:${cap.visible} tr:${cap.transparent} op:${cap.opacity} wf:${cap.wireframe} col:${cap.color} em:${cap.emissive}@${cap.emissiveIntensity} sh:${cap.userData.isGlitchShaderCap} fc:${cap.userData.isFoundCap}`,
    capUniforms: u
      ? `target:${u.uTargetColor} err:${u.uIsError} ok:${u.uIsSuccess} fnd:${u.uIsFound} selIn:${u.uSelectInTransition}`
      : null,
    sideMat: `${side.type} vis:${side.visible} tr:${side.transparent} op:${side.opacity} sh:${side.userData.isGlitchShaderCap}`,
  };
}

describe("useGlobePolygons characterization — Full Matrix Snapshots", () => {
  beforeEach(() => {
    resetGlobePolygonTestGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobePolygonTestGlobals();
  });

  it("freezes the world modes × states matrix via snapshot", () => {
    const cases = [
      {
        id: "countries | neutral+selected+found",
        props: {
          mode: "countries",
          selectedCountry: "France",
          foundSet: new Set(["Spain"]),
        },
        features: [FEATURE_FRANCE, FEATURE_SPAIN, FEATURE_BRAZIL],
      },
      {
        id: "countries | error-flash",
        props: {
          mode: "countries",
          selectedCountry: "France",
          isError: true,
        },
        features: [FEATURE_FRANCE],
      },
      {
        id: "countries | success-flash",
        props: {
          mode: "countries",
          selectedCountry: "France",
          isSuccess: true,
          foundSet: new Set(["France"]),
        },
        features: [FEATURE_FRANCE],
      },
      {
        id: "rivers_mountains | selected-river",
        props: {
          mode: "rivers_mountains",
          selectedCountry: "Amazon",
        },
        features: [FEATURE_RIVER_AMAZON, FEATURE_FRANCE],
      },
      {
        id: "learn | selected+neutral",
        props: {
          mode: "learn",
          selectedCountry: "France",
        },
        features: [FEATURE_FRANCE, FEATURE_SPAIN],
      },
    ];

    const results = cases.map(({ id, props, features }) => {
      const { result, unmount } = renderHook(() => useGlobePolygons(createHookProps(props)));
      const rows = features.map((f) => compactRow(result.current, f));
      unmount();
      return { id, rows };
    });

    expect(results).toMatchSnapshot();
  });

  it("freezes regional, conquest, and transitionStep (0, mid, end) matrix via snapshot", () => {
    const nowSpy = vi.spyOn(performance, "now").mockReturnValue(5000);
    const transRef = {
      current: {
        active: true,
        fromDept: false,
        fromUs: false,
        toDept: true,
        toUs: false,
        startTime: 5000,
        duration: MODE_TRANSITION_MS,
      },
    };

    const runCase = (props, features) => {
      const { result, unmount } = renderHook(() => useGlobePolygons(createHookProps(props)));
      const rows = features.map((f) => compactRow(result.current, f));
      unmount();
      return rows;
    };

    const step0 = runCase(
      {
        mode: "departments",
        isDepartmentMode: true,
        modeTransitionRef: transRef,
        transitionStep: 0,
      },
      [FEATURE_DEPT_AIN, { ...FEATURE_SPAIN, isGhostCountry: true }]
    );

    nowSpy.mockReturnValue(5000 + MODE_TRANSITION_MS * 0.5);
    const stepMid = runCase(
      {
        mode: "departments",
        isDepartmentMode: true,
        modeTransitionRef: transRef,
        transitionStep: 2,
      },
      [FEATURE_DEPT_AIN, { ...FEATURE_SPAIN, isGhostCountry: true }]
    );

    nowSpy.mockReturnValue(5000 + MODE_TRANSITION_MS + 10);
    const stepEnd = runCase(
      {
        mode: "departments",
        isDepartmentMode: true,
        modeTransitionRef: transRef,
        transitionStep: 5,
      },
      [FEATURE_DEPT_AIN, { ...FEATURE_SPAIN, isGhostCountry: true }]
    );

    const usStatesRows = runCase(
      {
        mode: "us_states",
        isUsStatesMode: true,
        selectedCountry: "California",
      },
      [FEATURE_US_CALIFORNIA]
    );

    const conquestRows = runCase(
      {
        mode: "countries",
        selectedCountry: "France",
        conquestOverlay: { ...CONQUEST_OVERLAY_FIXTURE, quietFocusId: "France" },
      },
      [FEATURE_FRANCE, FEATURE_SPAIN, FEATURE_JAPAN]
    );

    expect({
      step0,
      stepMid,
      stepEnd,
      usStatesRows,
      conquestRows,
    }).toMatchSnapshot();
  });
});
