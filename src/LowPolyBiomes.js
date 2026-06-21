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



export const createMountainFeature = (themeName = 'dark', isSelected = false, bearing = 0, spread = 1.5, height = 4000) => {
  const group = new THREE.Group();
  
  // Dynamic material based on selection state
  const rockKey = 'realisticMountainRock' + (isSelected ? '_sel' : '');
  const rockMat = getMaterial(rockKey, () => new THREE.MeshStandardMaterial({
    color: isSelected ? 0x059669 : 0x5a5a5a,
    emissive: isSelected ? 0x34d399 : 0x000000,
    emissiveIntensity: isSelected ? 1.4 : 0.0,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true
  }));

  const snowKey = 'realisticMountainSnow' + (isSelected ? '_sel' : '');
  const snowMat = getMaterial(snowKey, () => new THREE.MeshStandardMaterial({
    color: isSelected ? 0xd1fae5 : 0xfcfcfc,
    emissive: isSelected ? 0x10b981 : 0x000000,
    emissiveIntensity: isSelected ? 0.3 : 0.0,
    roughness: 0.5,
    metalness: 0.1,
    flatShading: true
  }));

  // Determine number of peaks based on spread (length) of the range
  const N = Math.max(3, Math.min(8, Math.round(spread * 2)));
  const localSpread = spread * 0.16; // Map degrees to local Three.js scale
  const rad = (bearing || 0) * Math.PI / 180;
  const dx = Math.cos(rad);
  const dz = Math.sin(rad);

  // Perpendicular vector for randomized offset
  const perpX = -dz;
  const perpZ = dx;

  for (let i = 0; i < N; i++) {
    const t = (N > 1) ? ((i / (N - 1)) - 0.5) : 0;
    
    // Bell curve height distribution (taller in the center, tapering at the edges)
    const bellFactor = Math.cos(t * Math.PI); // cos goes from 1 at t=0 to 0 at t=±0.5
    // Add randomized height variation (between 0.8 and 1.2)
    const randomVariation = 0.8 + ((Math.sin(i * 37.1) + 1) / 2) * 0.4;
    const hFactor = bellFactor * randomVariation;

    // Local position along the ridge line
    let X = t * localSpread * dx;
    let Z = t * localSpread * dz;

    // Slight perpendicular offset for natural rugged look
    const randOffsetVal = (Math.sin(i * 92.4) + Math.cos(i * 12.3)) * 0.5; // deterministic "random" between -1 and 1
    X += randOffsetVal * 0.045 * localSpread * perpX;
    Z += randOffsetVal * 0.045 * localSpread * perpZ;

    // Scale peak dimensions proportional to the mountain's height
    const normalizedHeightScale = height / 5000; // default relative to Mont Blanc / generic 5000m
    const peakHeight = 0.28 * hFactor * normalizedHeightScale;
    const peakRadius = peakHeight * 0.44;

    const peakGeoKey = `peakGeo_${bearing}_${spread}_${height}_${isSelected}_${i}`;
    const peakGeo = getGeometry(peakGeoKey, () => {
      const geo = new THREE.ConeGeometry(peakRadius, peakHeight, 8, 4);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        const z = pos.getZ(j);
        // Distort geometry above the base for a rugged, realistic rock face
        if (y > -peakHeight / 2) {
          const angle = Math.atan2(z, x);
          const noise = Math.sin(angle * 4) * 0.03 + Math.cos(y * 18) * 0.015;
          pos.setX(j, x + x * noise);
          pos.setZ(j, z + z * noise);
        }
      }
      geo.computeVertexNormals();
      return geo;
    });

    const peak = new THREE.Mesh(peakGeo, rockMat);
    // ConeGeometry center is at y=0, so offset by peakHeight/2 to align base to surface (y=0)
    peak.position.set(X, peakHeight / 2, Z);
    peak.rotation.y = ((i * 19.3) % (Math.PI * 2)); // deterministic rotation
    group.add(peak);

    // Snow caps on peaks that are high enough
    if (height > 2000) {
      const snowHeight = peakHeight * 0.38;
      const snowRadius = peakRadius * 0.42;
      
      const snowGeoKey = `snowGeo_${bearing}_${spread}_${height}_${isSelected}_${i}`;
      const snowGeo = getGeometry(snowGeoKey, () => {
        const geo = new THREE.ConeGeometry(snowRadius, snowHeight, 8, 2);
        const spos = geo.attributes.position;
        for (let j = 0; j < spos.count; j++) {
          const x = spos.getX(j);
          const y = spos.getY(j);
          const z = spos.getZ(j);
          if (y > -snowHeight / 2) {
            const angle = Math.atan2(z, x);
            const noise = Math.sin(angle * 4) * 0.025;
            spos.setX(j, x + x * noise);
            spos.setZ(j, z + z * noise);
          }
        }
        geo.computeVertexNormals();
        return geo;
      });

      const snow = new THREE.Mesh(snowGeo, snowMat);
      // Place snow cap centered near the peak top
      snow.position.set(X, peakHeight - snowHeight * 0.58, Z);
      snow.rotation.y = peak.rotation.y;
      group.add(snow);
    }
  }

  // Force culling and optimize shadows
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
    }
  });

  return group;
};

export const createUnfoundPlaceholder = (type, themeName = 'dark', isSelected = false, bearing = 0, spread = 1.5) => {
  const group = new THREE.Group();
  
  if (type === 'mountain' || type === 'mountain_range') {
    // Holographic glowing peak range
    const colorKey = isSelected ? 'selPlaceholder' : 'unfoundPlaceholder';
    const mat = getMaterial(colorKey + 'Mat', () => new THREE.MeshBasicMaterial({
      color: isSelected ? 0x34d399 : 0x94a3b8, // Slate gray or glowing green
      transparent: true,
      opacity: isSelected ? 0.8 : 0.45,
      wireframe: true
    }));

    // Render 3 smaller wireframe cones representing the range ridge
    const N = 3;
    const localSpread = spread * 0.16;
    const rad = (bearing || 0) * Math.PI / 180;
    const dx = Math.cos(rad);
    const dz = Math.sin(rad);

    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) - 0.5;
      const bell = Math.cos(t * Math.PI);
      const X = t * localSpread * dx;
      const Z = t * localSpread * dz;

      const peakHeight = 0.22 * bell;
      const peakRadius = peakHeight * 0.45;

      const peakGeoKey = `unfoundPeakGeo_${bearing}_${spread}_${i}`;
      const geo = getGeometry(peakGeoKey, () => new THREE.ConeGeometry(peakRadius, peakHeight, 5));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(X, peakHeight / 2, Z);
      group.add(mesh);
    }
  } else {
    // Rivers are interactive 3D paths, so we DO NOT draw any point marker objects!
    // Returning an empty group to avoid displaying unwanted droplets.
  }
  
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
    }
  });
  
  return group;
};
