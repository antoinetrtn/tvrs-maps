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

const addLake = (group, tone = 'temperate') => {
  const waterMat = getMaterial(`lake-${tone}`, () => new THREE.MeshLambertMaterial({
    color: tone === 'ice' ? 0xb8f1ff : 0x2f9fd8,
    flatShading: true
  }));
  const shoreMat = getMaterial(`shore-${tone}`, () => new THREE.MeshLambertMaterial({
    color: tone === 'ice' ? 0xe7f8fb : 0x9a8758,
    flatShading: true
  }));
  const shore = new THREE.Mesh(
    getGeometry('lakeShore', () => new THREE.CylinderGeometry(0.24, 0.28, 0.025, 7)),
    shoreMat
  );
  shore.position.y = 0.012;
  shore.scale.set(1.15, 1, 0.72);
  group.add(shore);

  const water = new THREE.Mesh(
    getGeometry('lakeWater', () => new THREE.CylinderGeometry(0.2, 0.23, 0.03, 7)),
    waterMat
  );
  water.position.y = 0.03;
  water.scale.set(1.1, 1, 0.66);
  water.rotation.y = 0.35;
  group.add(water);
};

const addRockCluster = (group, tone = 'stone') => {
  const rockMat = getMaterial(`rocks-${tone}`, () => new THREE.MeshLambertMaterial({
    color: tone === 'warm' ? 0xb36b32 : tone === 'ice' ? 0xc9e2e8 : 0x7d8272,
    flatShading: true
  }));
  const rockGeo = getGeometry('clusterRock', () => new THREE.DodecahedronGeometry(0.09, 0));
  for (let i = 0; i < 3; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set((i - 1) * 0.11, 0.045 + i * 0.01, (i % 2) * 0.07);
    rock.scale.set(1 + i * 0.18, 0.7 + i * 0.16, 0.85 + i * 0.12);
    rock.rotation.set(0.2 * i, 0.8 * i, 0.1 * i);
    group.add(rock);
  }
};

const addDeer = (group) => {
  const bodyMat = getMaterial('deerBody', () => new THREE.MeshLambertMaterial({ color: 0x8a5a2f, flatShading: true }));
  const antlerMat = getMaterial('deerAntler', () => new THREE.MeshLambertMaterial({ color: 0xe6d2a3, flatShading: true }));
  const body = new THREE.Mesh(getGeometry('deerBody', () => new THREE.BoxGeometry(0.22, 0.1, 0.09)), bodyMat);
  body.position.y = 0.13;
  group.add(body);

  const head = new THREE.Mesh(getGeometry('deerHead', () => new THREE.BoxGeometry(0.08, 0.075, 0.07)), bodyMat);
  head.position.set(0.13, 0.18, 0);
  group.add(head);

  const legGeo = getGeometry('deerLeg', () => new THREE.CylinderGeometry(0.012, 0.014, 0.12, 4));
  [-0.07, 0.07].forEach(x => {
    [-0.028, 0.028].forEach(z => {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(x, 0.06, z);
      group.add(leg);
    });
  });

  const antlerGeo = getGeometry('deerAntler', () => new THREE.CylinderGeometry(0.006, 0.006, 0.1, 4));
  [-0.025, 0.025].forEach(z => {
    const antler = new THREE.Mesh(antlerGeo, antlerMat);
    antler.position.set(0.16, 0.245, z);
    antler.rotation.z = -0.35;
    group.add(antler);
  });
};

const addDeciduousTree = (group, trunkMat, foliageKey = 'deciduousFoliage', foliageColor = 0x4f7942) => {
  const trunkGeo = getGeometry(`${foliageKey}Trunk`, () => new THREE.CylinderGeometry(0.025, 0.04, 0.16, 4));
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.08;
  group.add(trunk);

  const foliageMat = getMaterial(foliageKey, () => new THREE.MeshLambertMaterial({ color: foliageColor, flatShading: true }));
  const leafGeo = getGeometry(`${foliageKey}Leaves`, () => new THREE.DodecahedronGeometry(0.13, 0));
  const leaves = new THREE.Mesh(leafGeo, foliageMat);
  leaves.position.y = 0.2;
  leaves.scale.set(1.1, 0.9, 1);
  group.add(leaves);
};

/**
 * Procedural low-poly 3D models generators.
 * All models have their origin at the base (Y = 0) to align perfectly with the globe surface.
 */
export const createBiomeAsset = (type, themeName = 'dark', variant = null) => {
  const isLight = themeName === 'light';
  const group = new THREE.Group();
  group.name = `biome-asset-${type}-${variant || 'default'}`;

  // Common materials
  const trunkMat = getMaterial('trunk', () => new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  const sandRockMat = getMaterial('sandRock', () => new THREE.MeshLambertMaterial({ color: 0xc2b280, flatShading: true }));
  const canyonRockMat = getMaterial('canyonRock', () => new THREE.MeshLambertMaterial({ color: 0xc04000, flatShading: true }));

  if (variant === 'lake') {
    addLake(group);
  } else if (variant === 'iceLake') {
    addLake(group, 'ice');
  } else if (variant === 'rocks') {
    addRockCluster(group, type === 'Africa' || type === 'Americas' ? 'warm' : type === 'Antarctic' ? 'ice' : 'stone');
  } else if (variant === 'deer') {
    addDeer(group);
  } else {
  
  switch (type) {
    case 'Europe': { // Green Pine Tree
      if (variant === 'deciduous') {
        addDeciduousTree(group, trunkMat, 'europeDeciduous', 0x5f8f4a);
        break;
      }
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
      if (variant !== 'cactus') {
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
      if (variant !== 'canyon') {
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
      if (variant !== 'bamboo') {
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
      if (variant === 'pine') {
        const trunkGeo = getGeometry('francePineTrunk', () => new THREE.CylinderGeometry(0.025, 0.04, 0.18, 4));
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.09;
        group.add(trunk);
        const foliageMat = getMaterial('francePineFoliage', () => new THREE.MeshLambertMaterial({ color: 0x356b3a, flatShading: true }));
        const foliageGeo = getGeometry('francePineFoliage', () => new THREE.CylinderGeometry(0, 0.16, 0.32, 4));
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 0.28;
        group.add(foliage);
      } else {
        addDeciduousTree(group, trunkMat, 'franceFoliage', 0x4f7942);
      }
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
