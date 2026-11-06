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
    expect(glsl).toContain("float dayCityDim = mix(1.0, 0.35, dayAmt);");
    expect(glsl).toContain("baseLit = (landSurface * limbFactor + engrave) * sunLightMod;");
    expect(glsl).toContain("dayCityDim");
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
    // tierTentacle threshold 0.32
    expect(glsl).toContain("step(0.32, cityDensity)");
    // effectiveAura mix factor 0.22
    expect(glsl).toContain("effectiveAura * 0.22 * cityPower");
    // trafficWave amplitude 0.12 (base 0.88)
    expect(glsl).toContain("0.88 + 0.12 * sin(");
    // satTwinkle amplitude 0.12 (base 0.88)
    expect(glsl).toContain("0.88 + 0.12 * sin(uTime * 4.2");
    // tierTentacle sparkAlpha base 0.38 + 0.18
    expect(glsl).toContain("tierTentacle * (0.38 + 0.18 * cityHash2) * satTwinkle");
    // colorOuterTentacle darker amber
    expect(glsl).toContain("vec3(0.86, 0.48, 0.14)");
  });

  it("applies refined thresholds in WebGPU TSL layer", () => {
    const surfaceNodesPath = path.resolve(__dirname, "../globe/render/webgpu/surfaceNodes.js");
    const surfaceSource = fs.readFileSync(surfaceNodesPath, "utf8");
    expect(surfaceSource).toContain("step(0.32, cityDensity)");
    expect(surfaceSource).toContain("mul(0.12)\n    .add(0.88)");
    expect(surfaceSource).toContain("vec3(0.86, 0.48, 0.14)");
  });

  it("applies refined capital lights texture parameters", () => {
    const texPath = path.resolve(__dirname, "../globe/render/capitalLightsTexture.js");
    const texSource = fs.readFileSync(texPath, "utf8");
    // Reduced tentacles: secondary 3, compact 4, major 5, default 4
    expect(texSource).toContain("TENTACLES_BY_MODE = { secondary: 3, compact: 4, major: 5 };");
    expect(texSource).toContain("TENTACLES_BY_MODE[scaleMode] ?? 4;");
    // Reduced maxStepsBase: secondary 7, compact 9, major 16, default 12
    expect(texSource).toContain("STEPS_BY_MODE = { secondary: 7, compact: 9, major: 16 };");
    expect(texSource).toContain("STEPS_BY_MODE[scaleMode] ?? 12;");
    // Selective keepProb
    expect(texSource).toContain("0.86");
    expect(texSource).toContain("0.72");
    expect(texSource).toContain("0.56");
    // Aura steps: secondary 3, compact 4, major 6, default 5
    expect(texSource).toContain(
      "AURA_STEPS_BY_SCALE = {\n  secondary: 3,\n  compact: 4,\n  major: 6,\n};"
    );
    expect(texSource).toContain("return 5;");
    // Corridors max distDeg 7.5, isTownBead rarer
    expect(texSource).toContain("distDeg > 7.5");
    expect(texSource).toContain("i % 5 === 0 || rRand > 0.68");
    // satCount: 0 for compact/secondary, else 1
    expect(texSource).toContain('scaleMode === "compact" || scaleMode === "secondary" ? 0 : 1');
  });
});
