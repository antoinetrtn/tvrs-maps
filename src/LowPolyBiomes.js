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

const addMountain = (group, tone = 'alpine') => {
  const isIce = tone === 'ice';

  const rockMat = getMaterial(isIce ? 'iceRock' : 'mountainRock', () => new THREE.MeshLambertMaterial({
    color: isIce ? 0x93e1ed : 0x5a5a5a,
    flatShading: true
  }));

  const snowMat = getMaterial(isIce ? 'iceSnow' : 'mountainSnow', () => new THREE.MeshLambertMaterial({
    color: isIce ? 0xd6f7fc : 0xfcfcfc,
    flatShading: true
  }));

  // Main peak
  const mainPeakGeo = getGeometry('mainPeakGeo', () => new THREE.ConeGeometry(0.14, 0.35, 5));
  const mainPeak = new THREE.Mesh(mainPeakGeo, rockMat);
  mainPeak.position.set(0, 0.175, 0);
  group.add(mainPeak);

  // Main snow cap
  const mainSnowGeo = getGeometry('mainSnowGeo', () => new THREE.ConeGeometry(0.065, 0.16, 5));
  const mainSnow = new THREE.Mesh(mainSnowGeo, snowMat);
  mainSnow.position.set(0, 0.27, 0);
  group.add(mainSnow);

  // Secondary peak
  const secPeakGeo = getGeometry('secPeakGeo', () => new THREE.ConeGeometry(0.09, 0.24, 5));
  const secPeak = new THREE.Mesh(secPeakGeo, rockMat);
  secPeak.position.set(0.08, 0.12, 0.05);
  secPeak.rotation.y = 0.8;
  group.add(secPeak);

  // Secondary snow cap
  const secSnowGeo = getGeometry('secSnowGeo', () => new THREE.ConeGeometry(0.04, 0.10, 5));
  const secSnow = new THREE.Mesh(secSnowGeo, snowMat);
  secSnow.position.set(0.08, 0.19, 0.05);
  secSnow.rotation.y = 0.8;
  group.add(secSnow);
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

  // Secondary foliage material for organic two-toned look
  const colorObj = new THREE.Color(foliageColor);
  colorObj.offsetHSL(0.04, -0.05, 0.05); // slightly warmer/lighter
  const foliageMat2 = getMaterial(`${foliageKey}_var`, () => new THREE.MeshLambertMaterial({ color: colorObj.getHex(), flatShading: true }));

  const leafGeo = getGeometry(`${foliageKey}Leaves`, () => new THREE.DodecahedronGeometry(0.11, 0));
  const leaves = new THREE.Mesh(leafGeo, foliageMat);
  leaves.position.set(0, 0.19, 0);
  leaves.scale.set(1.1, 0.9, 1);
  group.add(leaves);

  const leaves2 = new THREE.Mesh(leafGeo, foliageMat2);
  leaves2.position.set(0.04, 0.24, 0.02);
  leaves2.scale.set(0.75, 0.75, 0.75);
  leaves2.rotation.set(0.2, 0.5, 0.1);
  group.add(leaves2);
};

const addCastle = (group) => {
  const stoneMat = getMaterial('castleStone', () => new THREE.MeshLambertMaterial({ color: 0x7a7a7a, flatShading: true }));
  const darkStoneMat = getMaterial('castleDarkStone', () => new THREE.MeshLambertMaterial({ color: 0x545454, flatShading: true }));
  const roofMat = getMaterial('castleRoof', () => new THREE.MeshLambertMaterial({ color: 0xb91c1c, flatShading: true })); // Red terracotta roof
  const flagMat = getMaterial('castleFlag', () => new THREE.MeshLambertMaterial({ color: 0xf59e0b, flatShading: true })); // Gold flag
  const mastMat = getMaterial('castleMast', () => new THREE.MeshLambertMaterial({ color: 0x3d2b1f }));

  // Main tower body
  const base = new THREE.Mesh(
    getGeometry('castleBase', () => new THREE.CylinderGeometry(0.07, 0.09, 0.22, 6)),
    stoneMat
  );
  base.position.y = 0.11;
  group.add(base);

  // Battlements (top platform)
  const battlements = new THREE.Mesh(
    getGeometry('castleBattlements', () => new THREE.CylinderGeometry(0.08, 0.08, 0.04, 6)),
    darkStoneMat
  );
  battlements.position.y = 0.23;
  group.add(battlements);

  // Roof
  const roof = new THREE.Mesh(
    getGeometry('castleRoof', () => new THREE.ConeGeometry(0.08, 0.1, 6)),
    roofMat
  );
  roof.position.y = 0.29;
  group.add(roof);

  // Mast
  const mast = new THREE.Mesh(
    getGeometry('castleMast', () => new THREE.CylinderGeometry(0.003, 0.003, 0.08, 4)),
    mastMat
  );
  mast.position.set(0, 0.36, 0);
  group.add(mast);

  // Flag
  const flag = new THREE.Mesh(
    getGeometry('castleFlag', () => new THREE.BoxGeometry(0.03, 0.015, 0.002)),
    flagMat
  );
  flag.position.set(0.015, 0.39, 0);
  group.add(flag);
};

const addPyramid = (group) => {
  const sandMat = getMaterial('pyramidSand', () => new THREE.MeshLambertMaterial({ color: 0xd9c59e, flatShading: true }));
  const goldMat = getMaterial('pyramidGold', () => new THREE.MeshPhongMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.15,
    shininess: 32
  }));

  // Layer 1 (Bottom)
  const l1 = new THREE.Mesh(
    getGeometry('pyrLayer1', () => new THREE.BoxGeometry(0.24, 0.045, 0.24)),
    sandMat
  );
  l1.position.y = 0.0225;
  group.add(l1);

  // Layer 2 (Middle)
  const l2 = new THREE.Mesh(
    getGeometry('pyrLayer2', () => new THREE.BoxGeometry(0.17, 0.045, 0.17)),
    sandMat
  );
  l2.position.y = 0.0675;
  group.add(l2);

  // Layer 3 (Upper)
  const l3 = new THREE.Mesh(
    getGeometry('pyrLayer3', () => new THREE.BoxGeometry(0.1, 0.045, 0.1)),
    sandMat
  );
  l3.position.y = 0.1125;
  group.add(l3);

  // Pyramidion (Golden Peak)
  const top = new THREE.Mesh(
    getGeometry('pyrTop', () => new THREE.ConeGeometry(0.045, 0.045, 4)),
    goldMat
  );
  top.position.y = 0.155;
  top.rotation.y = Math.PI / 4; // Align with boxes
  group.add(top);
};

const addVolcano = (group) => {
  const rockMat = getMaterial('volcanoRock', () => new THREE.MeshLambertMaterial({ color: 0x2b2b2b, flatShading: true }));
  const lavaMat = getMaterial('volcanoLava', () => new THREE.MeshPhongMaterial({
    color: 0xff3300,
    emissive: 0xff3300,
    emissiveIntensity: 1.8,
    shininess: 20
  }));

  // Volcano body (truncated cone)
  const body = new THREE.Mesh(
    getGeometry('volcanoBody', () => new THREE.CylinderGeometry(0.035, 0.18, 0.18, 7)),
    rockMat
  );
  body.position.y = 0.09;
  group.add(body);

  // Lava crater cap
  const lava = new THREE.Mesh(
    getGeometry('volcanoLava', () => new THREE.CylinderGeometry(0.031, 0.031, 0.015, 7)),
    lavaMat
  );
  lava.position.y = 0.18;
  group.add(lava);
};

const addBuilding = (group) => {
  const steelMat = getMaterial('buildingSteel', () => new THREE.MeshLambertMaterial({
    color: 0x8fa3b5,
    flatShading: true
  }));
  const steelDarkMat = getMaterial('buildingSteelDark', () => new THREE.MeshLambertMaterial({
    color: 0x5e7080,
    flatShading: true
  }));
  const glassMat = getMaterial('buildingGlass', () => new THREE.MeshPhongMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.2,
    shininess: 32
  }));
  const beaconMat = getMaterial('buildingBeacon', () => new THREE.MeshBasicMaterial({
    color: 0xff3b30
  }));

  // Base segment (large tower block)
  const baseGeo = getGeometry('buildingBase', () => new THREE.BoxGeometry(0.09, 0.26, 0.09));
  const base = new THREE.Mesh(baseGeo, steelMat);
  base.position.y = 0.13;
  group.add(base);

  // Stepped mid segment
  const midGeo = getGeometry('buildingMid', () => new THREE.BoxGeometry(0.065, 0.08, 0.065));
  const mid = new THREE.Mesh(midGeo, steelDarkMat);
  mid.position.y = 0.30;
  group.add(mid);

  // Stepped top segment
  const topGeo = getGeometry('buildingTop', () => new THREE.BoxGeometry(0.04, 0.04, 0.04));
  const topMesh = new THREE.Mesh(topGeo, steelMat);
  topMesh.position.y = 0.36;
  group.add(topMesh);

  // Antenna spire
  const spireGeo = getGeometry('buildingSpire', () => new THREE.CylinderGeometry(0.004, 0.006, 0.09, 4));
  const spire = new THREE.Mesh(spireGeo, steelDarkMat);
  spire.position.y = 0.425;
  group.add(spire);

  // Warning beacon light on top
  const beaconGeo = getGeometry('buildingBeaconGeo', () => new THREE.SphereGeometry(0.012, 5, 5));
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 0.47;
  group.add(beacon);

  // Procedural glowing windows (sky blue glass strips running down the sides)
  const winVertGeo = getGeometry('buildingWinVert', () => new THREE.BoxGeometry(0.012, 0.18, 0.094));
  const winVert = new THREE.Mesh(winVertGeo, glassMat);
  winVert.position.set(0, 0.13, 0);
  group.add(winVert);

  const winHorizGeo = getGeometry('buildingWinHoriz', () => new THREE.BoxGeometry(0.094, 0.18, 0.012));
  const winHoriz = new THREE.Mesh(winHorizGeo, glassMat);
  winHoriz.position.set(0, 0.13, 0);
  group.add(winHoriz);
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

  if (variant === 'lake' || variant === 'mountain') {
    addMountain(group);
  } else if (variant === 'iceLake' || variant === 'iceMountain') {
    addMountain(group, 'ice');
  } else if (variant === 'rocks') {
    addRockCluster(group, type === 'Africa' || type === 'Americas' || type === 'USA' ? 'warm' : type === 'Antarctic' ? 'ice' : 'stone');
  } else if (variant === 'deer') {
    addDeer(group);
  } else if (variant === 'castle') {
    addCastle(group);
  } else if (variant === 'pyramid') {
    addPyramid(group);
  } else if (variant === 'volcano') {
    addVolcano(group);
  } else if (variant === 'building') {
    addBuilding(group);
  } else {

  switch (type) {
    case 'USA':
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
    case 'Europe': { // Green Pine Tree
      if (variant === 'deciduous') {
        addDeciduousTree(group, trunkMat, 'europeDeciduous', 0x5f8f4a);
        break;
      }
      const trunkGeo = getGeometry('pineTrunk', () => new THREE.CylinderGeometry(0.04, 0.05, 0.2, 4));
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.1;
      group.add(trunk);

      // Multi-toned foliage for the Pine Tree
      const foliageMat1 = getMaterial('pineFoliage1', () => new THREE.MeshLambertMaterial({ color: 0x2e8b57, flatShading: true })); // Sea green
      const foliageMat2 = getMaterial('pineFoliage2', () => new THREE.MeshLambertMaterial({ color: 0x228b22, flatShading: true })); // Forest green

      const foliageGeo = getGeometry('pineFoliage', () => new THREE.CylinderGeometry(0, 0.25, 0.45, 4));

      const f1 = new THREE.Mesh(foliageGeo, foliageMat1);
      f1.position.y = 0.4;
      group.add(f1);

      const f2 = new THREE.Mesh(foliageGeo, foliageMat2);
      f2.scale.set(0.78, 0.78, 0.78);
      f2.position.y = 0.52;
      f2.rotation.y = Math.PI / 4;
      group.add(f2);
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

        // Pink cactus flowers
        const flowerMat = getMaterial('cactusFlower', () => new THREE.MeshLambertMaterial({ color: 0xf43f5e, flatShading: true })); // Rose pink
        const flowerGeo = getGeometry('cactusFlower', () => new THREE.DodecahedronGeometry(0.022, 0));

        const fMain = new THREE.Mesh(flowerGeo, flowerMat);
        fMain.position.set(0, 0.39, 0);
        group.add(fMain);

        const fLeft = new THREE.Mesh(flowerGeo, flowerMat);
        fLeft.position.set(-0.12, 0.27, 0);
        group.add(fLeft);

        const fRight = new THREE.Mesh(flowerGeo, flowerMat);
        fRight.position.set(0.12, 0.33, 0);
        group.add(fRight);
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

        const sakuraFoliageMat1 = getMaterial('sakuraFoliage1', () => new THREE.MeshLambertMaterial({ color: 0xffb7c5, flatShading: true })); // Pastel pink
        const sakuraFoliageMat2 = getMaterial('sakuraFoliage2', () => new THREE.MeshLambertMaterial({ color: 0xff8da1, flatShading: true })); // Darker pink
        const leafGeo = getGeometry('sakuraLeaves', () => new THREE.IcosahedronGeometry(0.14, 0));

        const leaves1 = new THREE.Mesh(leafGeo, sakuraFoliageMat1);
        leaves1.position.set(0, 0.26, 0);
        leaves1.scale.set(1.15, 0.9, 1.15);
        group.add(leaves1);

        const leaves2 = new THREE.Mesh(leafGeo, sakuraFoliageMat2);
        leaves2.scale.set(0.8, 0.8, 0.8);
        leaves2.position.set(0.07, 0.32, 0.04);
        leaves2.rotation.set(0.2, 0.4, 0.1);
        group.add(leaves2);

        const leaves3 = new THREE.Mesh(leafGeo, sakuraFoliageMat1);
        leaves3.scale.set(0.65, 0.65, 0.65);
        leaves3.position.set(-0.06, 0.30, -0.04);
        leaves3.rotation.set(-0.3, -0.2, 0.3);
        group.add(leaves3);

        // Falling sakura petals on the ground
        const petalMat = getMaterial('sakuraPetal', () => new THREE.MeshLambertMaterial({ color: 0xffb7c5, flatShading: true }));
        const petalGeo = getGeometry('sakuraPetal', () => new THREE.BoxGeometry(0.018, 0.005, 0.018));
        for (let i = 0; i < 3; i++) {
          const petal = new THREE.Mesh(petalGeo, petalMat);
          petal.position.set((Math.random() - 0.5) * 0.18, 0.003, (Math.random() - 0.5) * 0.18);
          petal.rotation.set(0.1, Math.random() * Math.PI, 0.1);
          group.add(petal);
        }
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

      // Coconuts under the leaves
      const cocoMat = getMaterial('coconut', () => new THREE.MeshLambertMaterial({ color: 0x5c3a21, flatShading: true }));
      const cocoGeo = getGeometry('coconut', () => new THREE.DodecahedronGeometry(0.022, 0));
      [-0.03, 0.02].forEach((x, idx) => {
        const coco = new THREE.Mesh(cocoGeo, cocoMat);
        coco.position.set(x - 0.015, 0.28, (idx === 0 ? 0.025 : -0.025));
        group.add(coco);
      });
      break;
    }

    case 'Antarctic': { // Iceberg
      // High-end glowing translucent crystal iceberg
      const iceMat = getMaterial('iceberg', () => new THREE.MeshPhongMaterial({
        color: 0xd0f8ff,
        emissive: 0x5ad8ff,
        emissiveIntensity: 0.35,
        shininess: 40,
        flatShading: true,
        transparent: true,
        opacity: 0.88
      }));
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
