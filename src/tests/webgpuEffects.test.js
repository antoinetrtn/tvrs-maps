import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { vec2 } from "three/tsl";
import { describe, expect, it } from "vitest";

import { getCapitalLightsTexture } from "../globe/render/capitalLightsTexture";
import { createGlobeLabelElement } from "../globe/render/globeLabelBuilder";
import { createFresnelGlowNodeMaterial } from "../globe/render/globeNodeMaterials";
import {
  applyCountryBorderDitherShader,
  applyCountrySurfaceGrainShader,
  stylePolygonBorderLine,
} from "../globe/render/globePolygonMaterial";
import {
  evaluateBayer4x4,
  FRESNEL_FRAGMENT_SHADER,
  GLITCH_FRAGMENT_BODY,
} from "../globe/render/globeShaders";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";
import { attachGlitchNodes } from "../globe/render/webgpu/glitchNode";
import {
  swapLineMaterialsForWebGPU,
  toDitheredLineBasicNodeMaterial,
  toLine2NodeMaterial,
} from "../globe/render/webgpu/lineMaterialSwap";
import {
  blackoutOceanOutputNode,
  countryGrainOutputNode,
  createPhongMaterial,
  createStandardMaterial,
  satelliteSensorColorNode,
} from "../globe/render/webgpu/surfaceNodes";
import { bayer4x4, mirrorUniform } from "../globe/render/webgpu/tslCommon";

describe("WebGPU effect ports", () => {
  it("keeps classic materials on the default WebGL path", () => {
    expect(createPhongMaterial({}).isNodeMaterial).toBeFalsy();
    expect(createStandardMaterial({}).isNodeMaterial).toBeFalsy();
  });

  it("exposes writable glitch uniforms mirroring the GLSL ones", () => {
    const a = { userData: {} };
    const b = { userData: {} };
    const ua = attachGlitchNodes(a, polygonGlitchUniforms, {
      uIsFound: 1,
      uFadeProgress: 0,
      uTargetColor: new THREE.Color(0xff0000),
    }).uniforms;
    const ub = attachGlitchNodes(b, polygonGlitchUniforms, {
      uIsFound: 0,
      uFadeProgress: 0,
    }).uniforms;
    ua.uFadeProgress.value = 0.5;
    ua.uTargetColor.value.set(0x00ff00);
    // Per-material values stay per material (WebGPU shares the pipeline).
    expect(a.userData.glitch.uFadeProgress).toBe(0.5);
    expect(b.userData.glitch.uFadeProgress).toBe(0);
    expect(ub.uIsFound.value).toBe(0);
    expect(a.userData.glitch.uTargetColor.getHex()).toBe(0x00ff00);
    expect(ua.uTime).toBe(ub.uTime);
    expect(a.outputNode).toBe(b.outputNode);
    expect(a.outputNode.isNode).toBe(true);
  });

  it("mirrors shared uniform holders every render", () => {
    const holder = { value: 1 };
    const node = mirrorUniform(holder);
    holder.value = 3;
    node.update?.({});
    expect(node.value).toBe(3);
    const color = { value: new THREE.Color(0xff0000) };
    const colorNode = mirrorUniform(color);
    color.value.set(0x00ff00);
    colorNode.update?.({});
    expect(colorNode.value.getHex()).toBe(0x00ff00);
  });

  it("builds the surface nodes", () => {
    expect(countryGrainOutputNode()).toBe(countryGrainOutputNode());
    expect(blackoutOceanOutputNode().isNode).toBe(true);
    expect(satelliteSensorColorNode(new THREE.Texture()).isNode).toBe(true);
  });

  it("swaps LineMaterial for an equivalent Line2NodeMaterial", () => {
    const lineMat = new LineMaterial({ color: 0x3399ff, linewidth: 3.8 });
    lineMat.transparent = true;
    lineMat.opacity = 0.5;
    const swapped = toLine2NodeMaterial(lineMat);
    expect(swapped.isLine2NodeMaterial).toBe(true);
    expect(swapped.color.getHex()).toBe(0x3399ff);
    expect(swapped.linewidth).toBe(3.8);
    expect(swapped.opacity).toBe(0.5);
    expect(swapped.defines).toEqual({});

    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new LineMaterial());
    scene.add(mesh);
    expect(swapLineMaterialsForWebGPU(scene)).toBe(1);
    expect(mesh.material.isLine2NodeMaterial).toBe(true);
    expect(swapLineMaterialsForWebGPU(scene)).toBe(0);
  });

  it("evaluates exact 4x4 Bayer matrix values periodic mod 4", () => {
    const values = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = evaluateBayer4x4(x, y);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(15 / 16);
        expect(Number.isInteger(v * 16)).toBe(true);
        values.push(v);
      }
    }
    const unique = new Set(values);
    expect(unique.size).toBe(16);

    expect(evaluateBayer4x4(0, 0)).toBe(0 / 16);
    expect(evaluateBayer4x4(1, 0)).toBe(8 / 16);
    expect(evaluateBayer4x4(2, 0)).toBe(2 / 16);
    expect(evaluateBayer4x4(3, 0)).toBe(10 / 16);
    expect(evaluateBayer4x4(0, 3)).toBe(15 / 16);

    for (let y = -4; y <= 8; y++) {
      for (let x = -4; x <= 8; x++) {
        const expected = evaluateBayer4x4(((x % 4) + 4) % 4, ((y % 4) + 4) % 4);
        expect(evaluateBayer4x4(x, y)).toBe(expected);
      }
    }

    const tslNode = bayer4x4(vec2(1, 2));
    expect(tslNode.isNode).toBe(true);
  });

  it("applies WebGL country surface grain shader hook", () => {
    const shader = {
      vertexShader: "void main() { #include <begin_vertex>\n#include <project_vertex> }",
      fragmentShader: "void main() { #include <dithering_fragment> }",
      uniforms: {},
    };
    applyCountrySurfaceGrainShader(shader);
    expect(shader.uniforms.uPixelScale).toBe(polygonGlitchUniforms.uPixelScale);
    expect(shader.vertexShader).toContain("vDitherWorldNormal");
    expect(shader.vertexShader).toContain("vDitherWorldPos");
    expect(shader.vertexShader).not.toContain("vSnapGrid");
    expect(shader.fragmentShader).not.toContain("gl_FragCoord");
    expect(shader.fragmentShader).toContain("topoGrid");
    expect(shader.fragmentShader).toContain("engrave");
    expect(shader.fragmentShader).toContain("isSideWall");
  });

  it("applies WebGL country border dither shader hook", () => {
    const shader = {
      vertexShader: "void main() { #include <begin_vertex>\n#include <project_vertex> }",
      fragmentShader: "void main() { #include <dithering_fragment> }",
      uniforms: {},
    };
    applyCountryBorderDitherShader(shader);
    expect(shader.uniforms.uPixelScale).toBe(polygonGlitchUniforms.uPixelScale);
    expect(shader.vertexShader).toContain("vBorderWorldPos");
    expect(shader.vertexShader).not.toContain("vSnapGrid");
    expect(shader.fragmentShader).not.toContain("gl_FragCoord");
    expect(shader.fragmentShader).toContain("bayer4x4");
    expect(shader.fragmentShader).toContain("borderStep");
    expect(shader.fragmentShader).not.toContain("discard");
    expect(GLITCH_FRAGMENT_BODY).not.toContain("gl_FragCoord");
    expect(GLITCH_FRAGMENT_BODY).toContain("sphereDir");
    expect(FRESNEL_FRAGMENT_SHADER).not.toContain("gl_FragCoord");
  });

  it("styles polygon border LineSegments with Bayer dither", () => {
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x555555 })
    );
    stylePolygonBorderLine(line);
    expect(line.material.transparent).toBe(true);
    expect(line.material.userData.hasBorderDither).toBe(true);
    expect(line.material.onBeforeCompile).toBe(applyCountryBorderDitherShader);

    // Re-applying is guarded
    const prevFn = line.material.onBeforeCompile;
    stylePolygonBorderLine(line);
    expect(line.material.onBeforeCompile).toBe(prevFn);

    // three-globe's reset (transparent = false) is ignored: no program switch,
    // so borders don't flicker on selection changes.
    line.material.transparent = false;
    const prevVersion = line.material.version;
    stylePolygonBorderLine(line);
    expect(line.material.transparent).toBe(true);
    expect(line.material.version).toBe(prevVersion);
  });

  it("converts polygon stroke LineBasicMaterial to LineBasicNodeMaterial with dither", () => {
    const basicMat = new THREE.LineBasicMaterial({ color: 0x444444, opacity: 0.8 });
    const ditheredMat = toDitheredLineBasicNodeMaterial(basicMat);
    expect(ditheredMat.isLineBasicNodeMaterial).toBe(true);
    expect(ditheredMat.transparent).toBe(true);
    expect(ditheredMat.userData.hasBorderDither).toBe(true);
    expect(ditheredMat.outputNode.isNode).toBe(true);

    const parent = new THREE.Group();
    parent.__globeObjType = "polygon";
    const stroke = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x333333 })
    );
    parent.add(stroke);
    const scene = new THREE.Scene();
    scene.add(parent);
    expect(swapLineMaterialsForWebGPU(scene)).toBe(1);
    expect(stroke.material.isLineBasicNodeMaterial).toBe(true);
  });

  it("creates Fresnel atmosphere node material with Bayer dither", () => {
    const mat = createFresnelGlowNodeMaterial({ color: 0x4fc3f7, coef: 0.9, power: 1.4 });
    expect(mat.isNodeMaterial).toBe(true);
    expect(mat.transparent).toBe(true);
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.opacityNode.isNode).toBe(true);
    expect(mat.uniforms.glowColor.value.getHex()).toBe(0x4fc3f7);
    expect(mat.uniforms.coef.value).toBe(0.9);
    expect(mat.uniforms.power.value).toBe(1.4);
  });

  it("packs city lights (R/G), mountain relief (B), and rivers (A) into capitalLightsTexture", () => {
    const tex = getCapitalLightsTexture();
    expect(tex.image.width).toBe(3600);
    expect(tex.image.height).toBe(1800);
    const data = tex.image.data;
    let nonZeroB = 0;
    let nonZeroA = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 2] > 0) nonZeroB++;
      if (data[i + 3] > 0) nonZeroA++;
    }
    expect(nonZeroB).toBeGreaterThan(500);
    expect(nonZeroA).toBeGreaterThan(500);
  });

  it("renders a minimized inline flag pill when a country is found in play mode", () => {
    const baseCtx = {
      UI_COLORS: {},
      REGION_COLORS_LABELS: {},
      isLightTheme: false,
      labelColors: {
        foundText: "var(--text-primary)",
        selectedText: "var(--text-primary)",
        stalkFound: "var(--accent)",
        stalkSelected: "var(--accent)",
      },
      mode: "countries",
      isLearnMode: false,
      isRiversMountainsMode: false,
      isPanelOpen: false,
      showFlag: true,
    };

    const selectedUnfoundEl = createGlobeLabelElement(
      { country: "France", capital: "Paris", iso2: "fr", isSelected: true, isFound: false },
      baseCtx
    );
    expect(selectedUnfoundEl.innerHTML).not.toContain("minimized-found-pill");
    expect(selectedUnfoundEl.innerHTML).toContain("globe-label-flag prominent");

    const foundEl = createGlobeLabelElement(
      { country: "France", capital: "Paris", iso2: "fr", isSelected: true, isFound: true },
      baseCtx
    );
    expect(foundEl.innerHTML).toContain("minimized-found-pill");
    expect(foundEl.innerHTML).toContain("globe-label-flag compact minimized-found");
    expect(foundEl.textContent.trim().length).toBe("France".length);
  });
});
