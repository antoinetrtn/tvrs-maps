import * as THREE from 'three';

// Cache for shared geometries and materials to avoid recreation and boost performance
const cache = {
  geometries: {},
  materials: {}
};

// Helper to get or create a shared geometry
const getGeometry = (key, creator) => {
  if (!cache.geometries[key]) {
    cache.geometries[key] = creator();
  }
  return cache.geometries[key];
};

// Helper to get or create a shared material
const getMaterial = (key, creator) => {
  if (!cache.materials[key]) {
    cache.materials[key] = creator();
  }
  return cache.materials[key];
};

// Clear cache on hot reload or disposal
export const disposeBiomeCache = () => {
  Object.values(cache.geometries).forEach(g => g.dispose());
  Object.values(cache.materials).forEach(m => m.dispose());
  cache.geometries = {};
  cache.materials = {};
};

/**
 * Procedural low-poly 3D models generators.
 * All models have their origin at the base (Y = 0) to align perfectly with the globe surface.
 */
export const createBiomeAsset = (type, themeName = 'dark') => {
  const isLight = themeName === 'light';
  const group = new THREE.Group();
  group.name = `biome-asset-${type}`;

  // Common materials
  const trunkMat = getMaterial('trunk', () => new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  const sandRockMat = getMaterial('sandRock', () => new THREE.MeshLambertMaterial({ color: 0xc2b280, flatShading: true }));
  const canyonRockMat = getMaterial('canyonRock', () => new THREE.MeshLambertMaterial({ color: 0xc04000, flatShading: true }));
  
  switch (type) {
    case 'Europe': { // Green Pine Tree
      const trunkGeo = getGeometry('pineTrunk', () => new THREE.CylinderGeometry(0.04, 0.05, 0.2, 4));
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.1;
      group.add(trunk);

      const foliageMat = getMaterial('pineFoliage', () => new THREE.MeshLambertMaterial({ color: 0x2e8b57, flatShading: true }));
      const foliageGeo = getGeometry('pineFoliage', () => new THREE.CylinderGeometry(0, 0.25, 0.45, 4));
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 0.4;
      group.add(foliage);
      break;
    }

    case 'Africa': { // Acacia or Cactus
      // 50% chance of acacia, 50% cactus
      if (Math.random() > 0.5) {
        // Low-poly Acacia
        const trunkGeo = getGeometry('acaciaTrunk', () => new THREE.CylinderGeometry(0.03, 0.05, 0.35, 4));
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.175;
        group.add(trunk);

        // Branch 1
        const b1 = new THREE.Mesh(trunkGeo, trunkMat);
        b1.scale.set(0.7, 0.7, 0.7);
        b1.position.set(0.05, 0.35, 0);
        b1.rotation.z = -0.4;
        group.add(b1);

        // Canopy
        const canopyMat = getMaterial('acaciaCanopy', () => new THREE.MeshLambertMaterial({ color: 0x556b2f, flatShading: true }));
        const canopyGeo = getGeometry('acaciaCanopy', () => new THREE.CylinderGeometry(0.32, 0.35, 0.12, 5));
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.y = 0.45;
        group.add(canopy);
      } else {
        // Low-poly Cactus
        const cactusMat = getMaterial('cactus', () => new THREE.MeshLambertMaterial({ color: 0x478c5c, flatShading: true }));
        const stemGeo = getGeometry('cactusStem', () => new THREE.CylinderGeometry(0.05, 0.05, 0.38, 4));
        const stem = new THREE.Mesh(stemGeo, cactusMat);
        stem.position.y = 0.19;
        group.add(stem);

        const branchGeo = getGeometry('cactusBranch', () => new THREE.CylinderGeometry(0.035, 0.035, 0.14, 4));
        const armLeft = new THREE.Mesh(branchGeo, cactusMat);
        armLeft.position.set(-0.08, 0.22, 0);
        armLeft.rotation.z = 0.6;
        group.add(armLeft);

        const armRight = new THREE.Mesh(branchGeo, cactusMat);
        armRight.position.set(0.08, 0.28, 0);
        armRight.rotation.z = -0.6;
        group.add(armRight);
      }
      break;
    }

    case 'Americas': { // Tall Pine Tree or Canyon rock spire
      if (Math.random() > 0.4) {
        // Redwoods/Conifer
        const trunkGeo = getGeometry('tallTrunk', () => new THREE.CylinderGeometry(0.03, 0.05, 0.25, 4));
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.125;
        group.add(trunk);

        const foliageMat = getMaterial('tallFoliage', () => new THREE.MeshLambertMaterial({ color: 0x1c4a2a, flatShading: true }));
        const f1Geo = getGeometry('tallFoliage1', () => new THREE.CylinderGeometry(0, 0.18, 0.3, 4));
        const f1 = new THREE.Mesh(f1Geo, foliageMat);
        f1.position.y = 0.32;
        group.add(f1);

        const f2 = new THREE.Mesh(f1Geo, foliageMat);
        f2.scale.set(0.8, 0.8, 0.8);
        f2.position.y = 0.48;
        group.add(f2);
      } else {
        // Canyon Rock Spire
        const spireGeo = getGeometry('canyonSpire', () => new THREE.CylinderGeometry(0.02, 0.12, 0.45, 5));
        const spire = new THREE.Mesh(spireGeo, canyonRockMat);
        spire.position.y = 0.225;
        spire.rotation.y = Math.random() * Math.PI;
        group.add(spire);
      }
      break;
    }

    case 'Asia': { // Cherry Blossom (Sakura) or Bamboo
      if (Math.random() > 0.5) {
        // Sakura
        const trunkGeo = getGeometry('sakuraTrunk', () => new THREE.CylinderGeometry(0.04, 0.06, 0.22, 4));
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.11;
        group.add(trunk);

        const foliageMat = getMaterial('sakuraFoliage', () => new THREE.MeshLambertMaterial({ color: 0xffb7c5, flatShading: true }));
        const leafGeo = getGeometry('sakuraLeaves', () => new THREE.IcosahedronGeometry(0.18, 0));
        const leaves1 = new THREE.Mesh(leafGeo, foliageMat);
        leaves1.position.set(0, 0.28, 0);
        group.add(leaves1);

        const leaves2 = new THREE.Mesh(leafGeo, foliageMat);
        leaves2.scale.set(0.7, 0.7, 0.7);
        leaves2.position.set(0.08, 0.35, 0.05);
        group.add(leaves2);
      } else {
        // Bamboo
        const bambooMat = getMaterial('bamboo', () => new THREE.MeshLambertMaterial({ color: 0x3cb371 }));
        const trunkGeo = getGeometry('bambooTrunk', () => new THREE.CylinderGeometry(0.02, 0.02, 0.48, 4));
        
        const b1 = new THREE.Mesh(trunkGeo, bambooMat);
        b1.position.set(0, 0.24, 0);
        group.add(b1);

        const b2 = new THREE.Mesh(trunkGeo, bambooMat);
        b2.scale.set(0.9, 0.9, 0.9);
        b2.position.set(0.08, 0.21, 0.04);
        b2.rotation.z = 0.12;
        group.add(b2);
      }
      break;
    }

    case 'Oceania': { // Palm Tree
      const trunkGeo = getGeometry('palmTrunk', () => new THREE.CylinderGeometry(0.025, 0.04, 0.32, 4));
      
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.16;
      trunk.rotation.z = 0.15; // Curved palm look
      group.add(trunk);

      const leafMat = getMaterial('palmLeaves', () => new THREE.MeshLambertMaterial({ color: 0x00a86b, flatShading: true }));
      const leafGeo = getGeometry('palmLeaf', () => new THREE.BoxGeometry(0.24, 0.015, 0.06));

      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(-0.02, 0.32, 0);
        leaf.rotation.y = (i * Math.PI * 2) / 5;
        leaf.rotation.z = -0.32; // Drooping leaves
        group.add(leaf);
      }
      break;
    }

    case 'Antarctic': { // Iceberg
      const iceMat = getMaterial('iceberg', () => new THREE.MeshLambertMaterial({ color: 0xe0f7fa, flatShading: true }));
      const iceGeo = getGeometry('iceberg', () => new THREE.IcosahedronGeometry(0.22, 0));
      const iceberg = new THREE.Mesh(iceGeo, iceMat);
      iceberg.position.y = 0.08; // Mostly sunken look
      iceberg.scale.set(1, 0.8 + Math.random() * 0.4, 1);
      iceberg.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
      group.add(iceberg);
      break;
    }

    case 'France': { // Cute small low poly deciduous tree (green / yellow)
      const trunkGeo = getGeometry('franceTrunk', () => new THREE.CylinderGeometry(0.025, 0.04, 0.15, 4));
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.075;
      group.add(trunk);

      const foliageMat = getMaterial('franceFoliage', () => new THREE.MeshLambertMaterial({ color: 0x4f7942, flatShading: true }));
      const leafGeo = getGeometry('franceLeaves', () => new THREE.DodecahedronGeometry(0.12, 0));
      const leaves = new THREE.Mesh(leafGeo, foliageMat);
      leaves.position.set(0, 0.18, 0);
      group.add(leaves);
      break;
    }

    default: { // Small rock spire
      const rock = new THREE.Mesh(
        getGeometry('defaultRock', () => new THREE.DodecahedronGeometry(0.1, 0)),
        sandRockMat
      );
      rock.position.y = 0.05;
      group.add(rock);
      break;
    }
  }

  // Force frustum culling on all child meshes
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
    }
  });

  return group;
};
