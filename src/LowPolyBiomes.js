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



export const createMountainFeature = (themeName = 'dark', isSelected = false, bearing = 0, spread = 1.5, height = 4000, path = null, centerLat = 0, centerLng = 0) => {
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

  if (path && Array.isArray(path) && path.length > 0) {
    const N = path.length;
    for (let i = 0; i < N; i++) {
      const pt = path[i];
      const pLat = pt[0];
      const pLng = pt[1];

      // Convert coordinates to local X/Z offsets relative to the group center
      const localX = (pLng - centerLng) * 0.16;
      const localZ = -(pLat - centerLat) * 0.16;

      // Bell curve height distribution
      const t = (N > 1) ? ((i / (N - 1)) - 0.5) : 0;
      const bellFactor = Math.cos(t * Math.PI);
      const randomVariation = 0.8 + ((Math.sin(i * 37.1) + 1) / 2) * 0.4;
      const hFactor = bellFactor * randomVariation;

      const normalizedHeightScale = height / 5000;
      const peakHeight = 0.28 * hFactor * normalizedHeightScale;
      const peakRadius = peakHeight * 0.44;

      const peakGeoKey = `peakGeo_${centerLat}_${centerLng}_${height}_${isSelected}_${i}`;
      const peakGeo = getGeometry(peakGeoKey, () => {
        const geo = new THREE.ConeGeometry(peakRadius, peakHeight, 8, 4);
        const pos = geo.attributes.position;
        for (let j = 0; j < pos.count; j++) {
          const x = pos.getX(j);
          const y = pos.getY(j);
          const z = pos.getZ(j);
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
      peak.position.set(localX, peakHeight / 2, localZ);
      peak.rotation.y = ((i * 19.3) % (Math.PI * 2));
      group.add(peak);

      if (height > 2000) {
        const snowHeight = peakHeight * 0.38;
        const snowRadius = peakRadius * 0.42;
        
        const snowGeoKey = `snowGeo_${centerLat}_${centerLng}_${height}_${isSelected}_${i}`;
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
        snow.position.set(localX, peakHeight - snowHeight * 0.58, localZ);
        snow.rotation.y = peak.rotation.y;
        group.add(snow);
      }
    }
  } else {
    // Fallback to straight line logic
    const N = Math.max(3, Math.min(8, Math.round(spread * 2)));
    const localSpread = spread * 0.16;
    const rad = (bearing || 0) * Math.PI / 180;
    const dx = Math.cos(rad);
    const dz = Math.sin(rad);
    const perpX = -dz;
    const perpZ = dx;

    for (let i = 0; i < N; i++) {
      const t = (N > 1) ? ((i / (N - 1)) - 0.5) : 0;
      const bellFactor = Math.cos(t * Math.PI);
      const randomVariation = 0.8 + ((Math.sin(i * 37.1) + 1) / 2) * 0.4;
      const hFactor = bellFactor * randomVariation;

      let X = t * localSpread * dx;
      let Z = t * localSpread * dz;

      const randOffsetVal = (Math.sin(i * 92.4) + Math.cos(i * 12.3)) * 0.5;
      X += randOffsetVal * 0.045 * localSpread * perpX;
      Z += randOffsetVal * 0.045 * localSpread * perpZ;

      const normalizedHeightScale = height / 5000;
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
      peak.position.set(X, peakHeight / 2, Z);
      peak.rotation.y = ((i * 19.3) % (Math.PI * 2));
      group.add(peak);

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
        snow.position.set(X, peakHeight - snowHeight * 0.58, Z);
        snow.rotation.y = peak.rotation.y;
        group.add(snow);
      }
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

export const createUnfoundPlaceholder = (type, themeName = 'dark', isSelected = false, bearing = 0, spread = 1.5, path = null, centerLat = 0, centerLng = 0) => {
  const group = new THREE.Group();
  
  if (type === 'mountain' || type === 'mountain_range') {
    const colorKey = isSelected ? 'selPlaceholder' : 'unfoundPlaceholder';
    const mat = getMaterial(colorKey + 'Mat', () => new THREE.MeshBasicMaterial({
      color: isSelected ? 0x34d399 : 0x64748b, // Slate gray or glowing green
      transparent: true,
      opacity: isSelected ? 0.8 : 0.45,
      wireframe: true
    }));

    if (path && Array.isArray(path) && path.length > 0) {
      const N = path.length;
      for (let i = 0; i < N; i++) {
        const pt = path[i];
        const pLat = pt[0];
        const pLng = pt[1];

        const localX = (pLng - centerLng) * 0.16;
        const localZ = -(pLat - centerLat) * 0.16;

        const t = (N > 1) ? ((i / (N - 1)) - 0.5) : 0;
        const bell = Math.cos(t * Math.PI);
        const peakHeight = 0.22 * bell;
        const peakRadius = peakHeight * 0.45;

        const peakGeoKey = `unfoundPeakGeo_${centerLat}_${centerLng}_${i}`;
        const geo = getGeometry(peakGeoKey, () => new THREE.ConeGeometry(peakRadius, peakHeight, 5));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(localX, peakHeight / 2, localZ);
        group.add(mesh);
      }
    } else {
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
    }
  } else {
    // Rivers do not draw any placeholder point markers
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
