import fs from "node:fs";
import path from "node:path";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { applyCountrySurfaceGrainShader } from "../globe/render/globePolygonMaterial";
import {
  COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY,
  GLITCH_FRAGMENT_DECLARATIONS,
} from "../globe/render/globeShaders";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";
import {
  blackoutOceanOutputNode,
  countryGrainOutputNode,
} from "../globe/render/webgpu/surfaceNodes";

describe("Sun terminator & oblique headlight lighting", () => {
  it("defines uSunDir in polygonGlitchUniforms as a normalized oblique vector", () => {
    expect(polygonGlitchUniforms.uSunDir).toBeDefined();
    expect(polygonGlitchUniforms.uSunDir.value).toBeInstanceOf(THREE.Vector3);
    const v = polygonGlitchUniforms.uSunDir.value;
    expect(v.length()).toBeCloseTo(1, 5);
    // CRITICAL: Not pure front camera (0, 0, 1) -> must have oblique X/Y components
    expect(Math.abs(v.x)).toBeGreaterThan(0.1);
    expect(Math.abs(v.y)).toBeGreaterThan(0.1);
  });

  it("includes uSunDir and smoothstep terminator formula in COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY", () => {
    const glsl = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(glsl).toContain("dot(sphereNormal, normalize(uSunDir))");
    expect(glsl).toContain(
      "float sunNdotL = clamp(dot(sphereNormal, normalize(uSunDir)), -1.0, 1.0);"
    );
    expect(glsl).toContain("float dayAmt = smoothstep(-0.08, 0.18, sunNdotL);");
    expect(glsl).toContain("float sunLightMod = mix(0.82, 1.12, dayAmt);");
    expect(glsl).toContain(
      "float cityDayAtten = mix(mix(1.0, 0.88, dayAmt), 1.0, uShowcaseLights);"
    );
    expect(glsl).toContain("baseLit = (landSurface * limbFactor + engrave) * sunLightMod;");
    expect(glsl).toContain("cityDayAtten");
    // Regression: day floor must stay high so camera-facing day side keeps cities.
    expect(glsl).toMatch(/mix\(1\.0,\s*0\.8[0-9],\s*dayAmt\)/);
  });

  it("wires uSunDir into the WebGL country polygon material onBeforeCompile", () => {
    const shader = {
      uniforms: {},
      vertexShader: "#include <begin_vertex>",
      fragmentShader: "#include <dithering_fragment>",
    };
    applyCountrySurfaceGrainShader(shader);
    expect(shader.uniforms.uSunDir).toBe(polygonGlitchUniforms.uSunDir);
    expect(shader.fragmentShader).toContain("uniform vec3 uSunDir;");
    expect(GLITCH_FRAGMENT_DECLARATIONS).toContain("uniform vec3 uSunDir;");
  });

  it("updates uSunDir every frame in useGlobeShaderClock via camera matrixWorld", () => {
    const clockFilePath = path.resolve(__dirname, "../globe/hooks/useGlobeShaderClock.js");
    const clockSource = fs.readFileSync(clockFilePath, "utf8");
    expect(clockSource).toContain("uSunDir");
    expect(clockSource).toContain("SUN_DIR_CAMERA");
    expect(clockSource).toContain("transformDirection(cam.matrixWorld)");
    expect(clockSource).toContain("polygonGlitchUniforms.uSunDir.value.copy");
  });

  it("wires uSunDir and ocean terminator in useGlobeMaterial shader", () => {
    const matFilePath = path.resolve(__dirname, "../globe/hooks/useGlobeMaterial.js");
    const matSource = fs.readFileSync(matFilePath, "utf8");
    expect(matSource).toContain("shader.uniforms.uSunDir = polygonGlitchUniforms.uSunDir;");
    expect(matSource).toContain("uniform vec3 uSunDir;");
    expect(matSource).toContain("dot(sphereDir, normalize(uSunDir))");
    expect(matSource).toContain("smoothstep(-0.08, 0.18, sunNdotL)");
    expect(matSource).toContain("gl_FragColor.rgb *= oceanSunMod;");
  });

  it("mirrors uSunDir in WebGPU sun/ocean/surface nodes", () => {
    const surfaceSource = fs.readFileSync(
      path.resolve(__dirname, "../globe/render/webgpu/surfaceNodes.js"),
      "utf8"
    );
    const sunSource = fs.readFileSync(
      path.resolve(__dirname, "../globe/render/webgpu/sunNodes.js"),
      "utf8"
    );
    const oceanSource = fs.readFileSync(
      path.resolve(__dirname, "../globe/render/webgpu/oceanNodes.js"),
      "utf8"
    );
    expect(sunSource).toContain("mirrorUniform(polygonGlitchUniforms.uSunDir)");
    expect(sunSource).toContain("sunNdotL");
    expect(oceanSource).toContain("oceanSunMultiplier");
    expect(surfaceSource).toContain("landSunMods");
    expect(surfaceSource).toContain("dayCityDim");

    const landNode = countryGrainOutputNode();
    expect(landNode).toBeDefined();
    expect(landNode.isNode).toBe(true);

    const oceanNode = blackoutOceanOutputNode();
    expect(oceanNode).toBeDefined();
    expect(oceanNode.isNode).toBe(true);
  });
});

describe("Urban lights refinements (less noisy, chic amber)", () => {
  it("applies refined thresholds and amplitudes in GLSL", () => {
    const glsl = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(glsl).toContain("step(0.27, cityDensity)");
    expect(glsl).toContain("effectiveAura * 0.28 * cityPower");
    expect(glsl).toContain("0.85 + 0.15 * sin(uTime * 2.8");
    expect(glsl).toContain("0.84 + 0.16 * sin(uTime * 4.2");
    expect(glsl).toContain("tierTentacle * (0.46 + 0.20 * cityHash2) * satTwinkle");
    expect(glsl).toContain("vec3(0.90, 0.50, 0.15)");
    expect(glsl).toContain("cityDayAtten");
  });

  it("applies refined thresholds in WebGPU TSL layer", () => {
    const surfaceNodesPath = path.resolve(__dirname, "../globe/render/webgpu/surfaceNodes.js");
    const surfaceSource = fs.readFileSync(surfaceNodesPath, "utf8");
    expect(surfaceSource).toContain("step(0.27, cityDensity)");
    expect(surfaceSource).toMatch(/\.mul\(0\.15\)/);
    expect(surfaceSource).toMatch(/\.add\(0\.85\)/);
    expect(surfaceSource).toMatch(/\.mul\(0\.16\)/);
    expect(surfaceSource).toMatch(/\.add\(0\.84\)/);
    expect(surfaceSource).toContain("0.9, 0.5, 0.15");
    expect(surfaceSource).toContain("cityDayAtten");
    expect(surfaceSource).toContain("0.88");
  });

  it("applies refined capital lights texture parameters", () => {
    const texPath = path.resolve(__dirname, "../globe/render/capitalLightsTexture.js");
    const texSource = fs.readFileSync(texPath, "utf8");
    expect(texSource).toContain("TENTACLES_BY_MODE = { secondary: 4, compact: 5, major: 6 };");
    expect(texSource).toContain("TENTACLES_BY_MODE[scaleMode] ?? 5;");
    expect(texSource).toContain("STEPS_BY_MODE = { secondary: 8, compact: 10, major: 20 };");
    expect(texSource).toContain("STEPS_BY_MODE[scaleMode] ?? 14;");
    expect(texSource).toContain("return 0.9;");
    expect(texSource).toContain("return 0.76;");
    expect(texSource).toContain("return 0.6;");
    expect(texSource).toContain("secondary: 4,\n  compact: 5,\n  major: 7,");
    expect(texSource).toContain("distDeg > 8.5");
    expect(texSource).toContain("i % 4 === 0 || rRand > 0.6");
    expect(texSource).toContain('scaleMode === "compact" || scaleMode === "secondary" ? 1 : 2');
  });

  it("does not multiply city spark by a harsh day floor below 0.8", () => {
    const glsl = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(glsl).not.toMatch(/mix\(1\.0,\s*0\.[0-7][0-9],\s*dayAmt\)/);
    expect(glsl).toContain("* cityDayAtten");
    expect(glsl).toContain("mix(mix(1.0, 0.88, dayAmt), 1.0, uShowcaseLights)");
  });
});
