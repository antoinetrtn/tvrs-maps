import * as THREE from "three";

import { GLOBE_RADIUS, latLngToVector3 } from "./BatchedGlobeEngine";

export function buildBatchedGlobeGeometry(features) {
  const capPositions = [];
  const capNormals = [];
  const capFeatureIndices = [];
  const capPickColors = [];

  const featureMap = new Map();
  const indexMap = new Map();

  features.forEach((feature, fIdx) => {
    const adminKey =
      feature.properties?.ADM0_A3 ||
      feature.properties?.ISO_A2 ||
      feature.properties?.code ||
      feature.properties?.NAME ||
      `feat_${fIdx}`;

    featureMap.set(adminKey, fIdx);
    indexMap.set(fIdx, adminKey);

    const pickId = fIdx + 1;
    const r = (pickId % 256) / 255.0;
    const g = Math.floor(pickId / 256) / 255.0;

    const geometryType = feature.geometry?.type;
    const coordinates = feature.geometry?.coordinates || [];

    const polygonList = geometryType === "MultiPolygon" ? coordinates : [coordinates];

    polygonList.forEach((poly) => {
      if (!poly || poly.length === 0) return;
      const outerRing = poly[0];
      if (!outerRing || outerRing.length < 3) return;

      const points3D = outerRing.map(([lng, lat]) => latLngToVector3(lat, lng, 0, GLOBE_RADIUS));

      // Calculate centroid normal
      const centroid = new THREE.Vector3();
      points3D.forEach((p) => centroid.add(p));
      centroid.divideScalar(points3D.length).normalize();

      // Simple fan triangulation relative to centroid for fast GPU geometry
      for (let i = 0; i < points3D.length - 1; i++) {
        const p1 = points3D[i];
        const p2 = points3D[i + 1];

        capPositions.push(centroid.x, centroid.y, centroid.z);
        capPositions.push(p1.x, p1.y, p1.z);
        capPositions.push(p2.x, p2.y, p2.z);

        const n1 = centroid.clone().normalize();
        const n2 = p1.clone().normalize();
        const n3 = p2.clone().normalize();

        capNormals.push(n1.x, n1.y, n1.z);
        capNormals.push(n2.x, n2.y, n2.z);
        capNormals.push(n3.x, n3.y, n3.z);

        capFeatureIndices.push(fIdx, fIdx, fIdx);

        capPickColors.push(r, g, 0.0, 1.0);
        capPickColors.push(r, g, 0.0, 1.0);
        capPickColors.push(r, g, 0.0, 1.0);
      }
    });
  });

  const capGeometry = new THREE.BufferGeometry();
  capGeometry.setAttribute("position", new THREE.Float32BufferAttribute(capPositions, 3));
  capGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(capNormals, 3));
  capGeometry.setAttribute("aFeatureIndex", new THREE.Float32BufferAttribute(capFeatureIndices, 1));
  capGeometry.setAttribute("aPickColor", new THREE.Float32BufferAttribute(capPickColors, 4));

  return {
    capGeometry,
    featureMap,
    indexMap,
  };
}
