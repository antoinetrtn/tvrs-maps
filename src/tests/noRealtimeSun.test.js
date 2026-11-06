import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY } from "../globe/render/globeShaders";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

/**
 * Perf regression: realtime camera-relative sun (PR298) made the globe choppy
 * for negligible visual gain. Keep restored city amber (PR301) without sun path.
 */
describe("no realtime directional sun (perf path)", () => {
  it("does not expose uSunDir on shared polygon uniforms", () => {
    expect(polygonGlitchUniforms.uSunDir).toBeUndefined();
  });

  it("does not update a camera-space sun each frame in useGlobeShaderClock", () => {
    const clock = readSrc("../globe/hooks/useGlobeShaderClock.js");
    expect(clock).not.toMatch(/uSunDir|SUN_DIR_CAMERA|scratchSunWorld|transformDirection/);
    expect(clock).not.toMatch(/from ["']three["']/);
  });

  it("drops sun terminator ALU from GLSL country grain", () => {
    const glsl = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(glsl).not.toMatch(/uSunDir|sunNdotL|sunLightMod|cityDayAtten|dayAmt/);
    expect(glsl).toContain("vec3 baseLit = landSurface * limbFactor + engrave;");
    expect(glsl).toContain("vec3 sideRgb = landSurface * 0.58;");
  });

  it("drops ocean sun multiplier from WebGL ocean material", () => {
    const ocean = readSrc("../globe/hooks/useGlobeMaterial.js");
    expect(ocean).not.toMatch(/uSunDir|oceanSunMod|sunNdotL/);
    expect(ocean).toContain("gl_FragColor.rgb += waveRgb + graticuleRgb;");
    expect(ocean).not.toContain("gl_FragColor.rgb *= oceanSunMod");
  });

  it("drops WebGPU sunNodes module and land/ocean sun wiring", () => {
    const sunPath = path.resolve(__dirname, "../globe/render/webgpu/sunNodes.js");
    expect(fs.existsSync(sunPath)).toBe(false);
    const surface = readSrc("../globe/render/webgpu/surfaceNodes.js");
    const ocean = readSrc("../globe/render/webgpu/oceanNodes.js");
    expect(surface).not.toMatch(/sunNodes|landSunMods|getSunDirNode|sunLightMod|cityDayAtten/);
    expect(ocean).not.toMatch(/sunNodes|oceanSunMultiplier|getOceanSunDirNode|oceanSunMod/);
    expect(ocean).toContain("litDisplayColor().add(waveRgb).add(graticuleRgb)");
  });

  it("keeps PR301 restored city amber character (not the aggressive PR298 dim path)", () => {
    const glsl = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(glsl).toContain("float trafficWave = 0.85 + 0.15 * sin(");
    expect(glsl).toContain("float satTwinkle = 0.84 + 0.16 * sin(");
    expect(glsl).toContain("step(0.27, cityDensity)");
    expect(glsl).toContain("tierTentacle * (0.46 + 0.20 * cityHash2)");
    expect(glsl).toContain("effectiveAura * 0.28 * cityPower");
    expect(glsl).toMatch(/vec3\(0\.90,\s*0\.50,\s*0\.15\)/);
    const tex = readSrc("../globe/render/capitalLightsTexture.js");
    expect(tex).toContain("TENTACLES_BY_MODE = { secondary: 4, compact: 5, major: 6 }");
    expect(tex).toContain("STEPS_BY_MODE = { secondary: 8, compact: 10, major: 20 }");
  });
});
