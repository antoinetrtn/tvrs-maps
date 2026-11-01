import { describe, expect, it } from "vitest";

import { stampCityIgnition } from "../globe/render/applyPolygonFeedbackUniforms";
import { registerCountryFeature } from "../globe/render/countryLandRadius";
import { DISCOVERY } from "../globe/render/discoveryTimeline";
import {
  COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY,
  GLITCH_FRAGMENT_BODY,
  GLITCH_FRAGMENT_DECLARATIONS,
} from "../globe/render/globeShaders";
import {
  getIgniteHolder,
  getIgniteSelfHolder,
  igniteState,
  isCountryRevealing,
  polygonGlitchUniforms,
} from "../globe/render/polygonGlitchShader";
import { countryGrainOutputNode } from "../globe/render/webgpu/surfaceNodes";

describe("discovery city ignition", () => {
  it("aims the wave at the capital with a radius covering the urban network", () => {
    const r = stampCityIgnition("France", 10);
    expect(r).toBeTruthy();
    const o = polygonGlitchUniforms.uIgniteOrigin.value;
    expect(o.length()).toBeCloseTo(1, 5);
    // Paris ≈ 48.9°N → y = sin(lat)
    expect(o.y).toBeGreaterThan(0.7);
    expect(r.radius).toBeGreaterThan(0.05);
    expect(r.radius).toBeLessThanOrEqual(0.6);
    expect(polygonGlitchUniforms.uIgniteStart.value).toBeGreaterThan(10);
  });

  it("gives each find its own timeline, and never replays an already-lit country", () => {
    const france = getIgniteSelfHolder("France");
    stampCityIgnition("France", 10);
    expect(france.value).toBe(1);
    const franceStart = getIgniteHolder("France").revealStart.value;
    const franceOrigin = getIgniteHolder("France").origin.value.clone();
    // Second find 1 s later: France keeps its own origin/start (no jump to fully lit).
    stampCityIgnition("Belgium", 11);
    expect(igniteState.admin).toBe("Belgium");
    expect(getIgniteHolder("France").revealStart.value).toBe(franceStart);
    expect(getIgniteHolder("France").origin.value.equals(franceOrigin)).toBe(true);
    expect(getIgniteHolder("Belgium").revealStart.value).toBe(11);
    expect(getIgniteSelfHolder("Belgium").value).toBe(1);
    expect(isCountryRevealing("France", 11.5)).toBe(true);
    // Once the reveal window is over, France settles and is never re-stamped by others.
    expect(isCountryRevealing("France", 10 + DISCOVERY.REVEAL_S + 1)).toBe(false);
    stampCityIgnition("Spain", 30);
    expect(getIgniteHolder("France").revealStart.value).toBe(franceStart);
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("igniteWindow * uIgniteSelf");
  });

  it("ignores unknown countries", () => {
    expect(stampCityIgnition("Atlantis", 1)).toBeNull();
  });

  it("gates city power by a per-pixel ignition front in GLSL", () => {
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("isAwakenedCap * igniteMask");
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("(1.0 - uReducedMotion)");
  });

  it("covers huge countries entirely: land radius = farthest polygon vertex", () => {
    // Moscow -> Chukotka (~177°E) is far beyond the 0.6 rad city clamp.
    registerCountryFeature("Russia", {
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [30, 55],
              [60, 70],
              [177, 66],
              [135, 43],
              [30, 55],
            ],
          ],
        ],
      },
    });
    const r = stampCityIgnition("Russia", 40);
    expect(r.landRadius).toBeGreaterThan(1.0);
    // City wave widened too, so far-east cities are not lit before the front reaches them.
    expect(r.radius).toBeGreaterThanOrEqual(r.landRadius);
    expect(polygonGlitchUniforms.uLandRadius.value).toBe(r.landRadius);
  });

  it("follows the discovery timeline: land at 0, cities +150 ms, gameplay flash unchanged", () => {
    const r = stampCityIgnition("France", 50);
    expect(r.revealStart).toBe(50);
    expect(polygonGlitchUniforms.uIgniteStart.value).toBeCloseTo(50 + DISCOVERY.CITY_DELAY_S, 6);
    expect(polygonGlitchUniforms.uIgniteDuration.value).toBe(DISCOVERY.CITY_S);
    expect(DISCOVERY.REVEAL_S).toBe(2);
    expect(DISCOVERY.CITY_DELAY_S + DISCOVERY.CITY_S).toBeCloseTo(1.5, 6);
    expect(polygonGlitchUniforms.uSuccessDuration.value).toBeCloseTo(0.38, 6);
  });

  it("drops the gold/white success flash for the stepped land reveal (GLSL)", () => {
    expect(GLITCH_FRAGMENT_DECLARATIONS).not.toContain("computeSuccessEffect");
    expect(GLITCH_FRAGMENT_DECLARATIONS).toContain("discoveryLandStep");
    expect(GLITCH_FRAGMENT_BODY).toContain("computeDiscoveryEffect");
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("discoveryLandStep(revealT");
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("mix(1.0, landMask, isAwakenedCap)");
  });

  it("builds the WebGPU twin", () => {
    expect(countryGrainOutputNode(false)).toBeTruthy();
  });
});
