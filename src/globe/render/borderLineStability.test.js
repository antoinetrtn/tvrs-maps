import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { stylePolygonBorderLine } from "./globePolygonMaterial";

describe("stylePolygonBorderLine — stabilité au changement de sélection", () => {
  it("garde la bordure transparente quand three-globe réécrit transparent=false", () => {
    const line = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    stylePolygonBorderLine(line);
    const mat = line.material;
    const version = mat.version;
    // Simule le digest three-globe à chaque clic (couleur opaque).
    mat.color.setRGB(1, 0.8, 0);
    mat.transparent = false;
    mat.opacity = 1;
    expect(mat.transparent).toBe(true);
    stylePolygonBorderLine(line);
    expect(line.material).toBe(mat);
    expect(mat.version).toBe(version);
  });
});
