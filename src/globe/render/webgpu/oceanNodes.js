/**
 * WebGPU blackout ocean: 5x5 pixel-art wavelets + camera-relative sun terminator.
 * TSL twin of useGlobeMaterial.applyBlackoutOceanShader.
 */
import * as THREE from "three";
import {
  abs,
  asin,
  atan,
  cameraPosition,
  clamp,
  cos,
  dot,
  exp2,
  float,
  floor,
  Fn,
  fract,
  fwidth,
  length,
  log2,
  max,
  mix,
  normalize,
  normalWorld,
  positionWorld,
  pow,
  select,
  sin,
  step,
  vec2,
  vec3,
} from "three/tsl";

import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { bayer4x4, displayOutput, hash, litDisplayColor, mirrorUniform } from "./tslCommon";

let oceanTimeNode = null;

/** blackoutOceanOutputNode: minimalist monochrome 5x5 pixel-art wavelet / ASCII ocean */
export function blackoutOceanOutputNode(
  rimColor = new THREE.Color(0.85, 0.88, 0.92),
  rimStrength = 0.07
) {
  const uTimeNode = (oceanTimeNode ||= mirrorUniform(polygonGlitchUniforms.uTime));
  return Fn(() => {
    const sphereDir = normalize(normalWorld);
    const rawLat = asin(clamp(sphereDir.y, -1.0, 1.0));
    const rawLng = atan(sphereDir.z, sphereDir.x);
    const latNorm = rawLat.div(3.14159265).add(0.5);
    const camAlt = max(length(cameraPosition).sub(100.0), 15.0);
    const zoomOctave = exp2(floor(log2(clamp(float(230.0).div(camAlt), 1.0, 8.0)).add(0.5)));
    const resLat = float(48.0).mul(zoomOctave);

    const cellRow = floor(rawLat.mul(resLat));
    const rowLat = cellRow.add(0.5).div(resLat);
    const colsPerRad = max(floor(resLat.mul(cos(rowLat)).mul(1.15).add(0.5)), 8.0);
    const cellCol = floor(rawLng.mul(colsPerRad));

    const cellUv = vec2(fract(rawLng.mul(colsPerRad)), fract(rawLat.mul(resLat)));
    const subPx = floor(cellUv.mul(5.0));
    const sx = subPx.x;
    const sy = subPx.y;

    const cellId = vec2(cellCol, cellRow);
    const cellHash = hash(cellId);

    const qSphere = vec2(cellCol.add(0.5).div(colsPerRad), rowLat);
    const swellA = sin(
      qSphere.x
        .mul(11.0)
        .add(uTimeNode.mul(0.65))
        .add(sin(qSphere.y.mul(6.0)).mul(1.4))
    ).mul(cos(qSphere.y.mul(9.0).sub(uTimeNode.mul(0.32))));
    const swellB = cos(qSphere.x.mul(17.0).sub(uTimeNode.mul(0.48)).add(qSphere.y.mul(5.0)));
    const swell = swellA.mul(0.65).add(swellB.mul(0.35));

    const waveActive = step(float(-0.08), swell).mul(step(float(0.62), cellHash));
    const bob = step(
      float(0.0),
      sin(uTimeNode.mul(1.9).add(cellHash.mul(6.2831853)).add(qSphere.x.mul(12.0)))
    );

    const tildeY = select(
      sx.lessThan(0.5),
      float(2.0),
      select(
        sx.lessThan(1.5),
        float(2.0).add(bob),
        select(sx.lessThan(2.5), float(2.0), float(2.0).sub(float(1.0).sub(bob)))
      )
    );
    const isTilde = step(sx, 3.5).mul(float(1.0).sub(step(0.5, abs(sy.sub(tildeY)))));
    const isDash = step(0.5, sx)
      .mul(step(sx, 3.5))
      .mul(float(1.0).sub(step(0.5, abs(sy.sub(2.0)))));
    const isDot = float(1.0)
      .sub(step(0.5, abs(sx.sub(2.0))))
      .mul(float(1.0).sub(step(0.5, abs(sy.sub(2.0)))));

    const glyphType = fract(cellHash.mul(19.7));
    const glyph = select(
      glyphType.lessThan(0.5),
      isTilde,
      select(glyphType.lessThan(0.8), isDash, isDot)
    );

    const breath = sin(uTimeNode.mul(1.4).add(cellHash.mul(6.2831853)))
      .mul(0.32)
      .add(0.68);
    const wavePixel = waveActive.mul(glyph).mul(breath);

    const n = normalize(normalWorld);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const viewIncidence = clamp(dot(n, viewDir), 0.0, 1.0);
    const globalSubPx = cellId.mul(5.0).add(subPx);
    const bayer = bayer4x4(globalSubPx);
    const limb = pow(clamp(float(1.0).sub(viewIncidence), 0.0, 1.0), 2.2);
    const limbBit = step(bayer.add(0.12), limb.mul(0.52)).mul(0.09);

    const rimColorVec = vec3(rimColor.r, rimColor.g, rimColor.b);
    const pixelAlpha = wavePixel.mul(float(rimStrength).mul(0.34).add(0.145)).add(limbBit);
    const waveRgb = mix(vec3(0.78, 0.82, 0.86), rimColorVec, 0.45).mul(pixelAlpha);

    const latWidth = max(fwidth(latNorm), 0.00045);
    const eqLine = clamp(float(1.0).sub(abs(latNorm.sub(0.5)).div(latWidth)), 0.0, 1.0);
    const tropicLine = clamp(
      float(1.0).sub(abs(abs(latNorm.sub(0.5)).sub(23.44 / 180.0)).div(latWidth)),
      0.0,
      1.0
    );
    const specialLines = max(eqLine, tropicLine);
    const specialDither = step(bayer.add(0.05), specialLines.mul(0.55)).mul(0.06);

    const graticuleColor = mix(vec3(0.55, 0.65, 0.75), rimColorVec, 0.45);
    const graticuleRgb = graticuleColor.mul(
      specialDither.mul(float(rimStrength).mul(0.28).add(0.07))
    );

    return displayOutput(litDisplayColor().add(waveRgb).add(graticuleRgb));
  })();
}
