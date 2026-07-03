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



// Helper to interpolate a point at parameter t (0 to 1) along a polyline path
const interpolatePath = (path, t) => {
  if (!path || path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];
  
  const segments = path.length - 1;
  const rawIndex = t * segments;
  const index = Math.min(segments - 1, Math.floor(rawIndex));
  const frac = rawIndex - index;
  
  const p1 = path[index];
  const p2 = path[index + 1];
  
  const lat = p1[0] + (p2[0] - p1[0]) * frac;
  const lng = p1[1] + (p2[1] - p1[1]) * frac;
  return [lat, lng];
};

export const createMountainFeature = (themeName = 'dark', isSelected = false, bearing = 0, spread = 1.5, height = 4000, path = null, centerLat = 0, centerLng = 0, groupScale = 9.2) => {
  const group = new THREE.Group();
  const isBlackoutSelected = themeName === 'blackout' && isSelected;
  
  // Dynamic material based on selection state
  const rockKey = `realisticMountainRock_${themeName}${isSelected ? '_sel' : ''}`;
  const rockMat = getMaterial(rockKey, () => new THREE.MeshStandardMaterial({
    color: isBlackoutSelected ? 0xffffff : (isSelected ? 0x059669 : 0x5a5a5a),
    emissive: isBlackoutSelected ? 0xffffff : (isSelected ? 0x34d399 : 0x000000),
    emissiveIntensity: isBlackoutSelected ? 0.65 : (isSelected ? 1.4 : 0.0),
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
    wireframe: isBlackoutSelected,
    transparent: isBlackoutSelected,
    opacity: isBlackoutSelected ? 0.72 : 1
  }));

  const snowKey = `realisticMountainSnow_${themeName}${isSelected ? '_sel' : ''}`;
  const snowMat = getMaterial(snowKey, () => new THREE.MeshStandardMaterial({
    color: isBlackoutSelected ? 0xffffff : (isSelected ? 0xd1fae5 : 0xfcfcfc),
    emissive: isBlackoutSelected ? 0xffffff : (isSelected ? 0x10b981 : 0x000000),
    emissiveIntensity: isBlackoutSelected ? 0.25 : (isSelected ? 0.3 : 0.0),
    roughness: 0.5,
    metalness: 0.1,
    flatShading: true,
    wireframe: isBlackoutSelected,
    transparent: isBlackoutSelected,
    opacity: isBlackoutSelected ? 0.82 : 1
  }));

  if (path && Array.isArray(path) && path.length > 0) {
    // Generate a high density of peaks proportional to range's spread (length)
    const N = Math.max(10, Math.round(spread * 4.5));
    for (let i = 0; i < N; i++) {
      const tNorm = (N > 1) ? (i / (N - 1)) : 0.5;
      const [pLat, pLng] = interpolatePath(path, tNorm);

      // Convert coordinates to exact Three.js units on a sphere of radius 100
      const R = 100;
      const latRad = pLat * Math.PI / 180;
      const dx = R * Math.cos(latRad) * (pLng - centerLng) * (Math.PI / 180);
      const dz = R * (pLat - centerLat) * (Math.PI / 180);

      // Divide by groupScale to get local coordinates inside the scaled group
      const localX = dx / groupScale;
      const localZ = -dz / groupScale;

      // Curvature correction: calculate height drop in local coordinates
      const dWorld = Math.sqrt(localX * localX + localZ * localZ) * groupScale;
      const deltaYWorld = R - Math.sqrt(Math.max(0.1, R * R - dWorld * dWorld));
      const deltaY = deltaYWorld / groupScale;

      // Bell curve height distribution
      const t = tNorm - 0.5; // -0.5 to 0.5
      const bellFactor = Math.cos(t * Math.PI);
      
      // Dynamic peak size and height variation (organic & dense)
      const randomHeightVar = 0.65 + ((Math.sin(i * 14.3) + 1) / 2) * 0.7; // 0.65 to 1.35
      const randomRadiusVar = 0.8 + ((Math.cos(i * 22.7) + 1) / 2) * 0.5; // 0.8 to 1.3
      const hFactor = bellFactor * randomHeightVar;

      const normalizedHeightScale = height / 5000;
      const peakHeight = 0.28 * hFactor * normalizedHeightScale;
      const peakRadius = peakHeight * 0.44 * randomRadiusVar;

      const peakGeoKey = `peakGeo_${centerLat}_${centerLng}_${height}_${isSelected}_${i}_v2`;
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
      peak.position.set(localX, peakHeight / 2 - deltaY, localZ);
      peak.rotation.y = ((i * 19.3) % (Math.PI * 2));
      group.add(peak);

      if (height > 2000) {
        const snowHeight = peakHeight * 0.38;
        const snowRadius = peakRadius * 0.42;
        
        const snowGeoKey = `snowGeo_${centerLat}_${centerLng}_${height}_${isSelected}_${i}_v2`;
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
        snow.position.set(localX, peakHeight - snowHeight * 0.58 - deltaY, localZ);
        snow.rotation.y = peak.rotation.y;
        group.add(snow);
      }
    }
  } else {
    // Fallback to straight line logic
    const N = Math.max(10, Math.round(spread * 4.5));
    const R = 100;
    const spreadWorld = R * spread * (Math.PI / 180);
    const localSpread = spreadWorld / groupScale;
    const rad = (bearing || 0) * Math.PI / 180;
    const dx = Math.cos(rad);
    const dz = Math.sin(rad);
    const perpX = -dz;
    const perpZ = dx;

    for (let i = 0; i < N; i++) {
      const tNorm = (N > 1) ? (i / (N - 1)) : 0.5;
      const t = tNorm - 0.5;
      const bellFactor = Math.cos(t * Math.PI);
      const randomHeightVar = 0.65 + ((Math.sin(i * 14.3) + 1) / 2) * 0.7;
      const randomRadiusVar = 0.8 + ((Math.cos(i * 22.7) + 1) / 2) * 0.5;
      const hFactor = bellFactor * randomHeightVar;

      let X = t * localSpread * dx;
      let Z = t * localSpread * dz;

      const randOffsetVal = (Math.sin(i * 92.4) + Math.cos(i * 12.3)) * 0.5;
      X += randOffsetVal * 0.045 * localSpread * perpX;
      Z += randOffsetVal * 0.045 * localSpread * perpZ;

      // Adjust height to follow the sphere's curvature (globe radius R = 100)
      const dWorld = Math.sqrt(X * X + Z * Z) * groupScale;
      const deltaYWorld = R - Math.sqrt(Math.max(0.1, R * R - dWorld * dWorld));
      const deltaY = deltaYWorld / groupScale;

      const normalizedHeightScale = height / 5000;
      const peakHeight = 0.28 * hFactor * normalizedHeightScale;
      const peakRadius = peakHeight * 0.44 * randomRadiusVar;

      const peakGeoKey = `peakGeo_${bearing}_${spread}_${height}_${isSelected}_${i}_v2`;
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
      peak.position.set(X, peakHeight / 2 - deltaY, Z);
      peak.rotation.y = ((i * 19.3) % (Math.PI * 2));
      group.add(peak);

      if (height > 2000) {
        const snowHeight = peakHeight * 0.38;
        const snowRadius = peakRadius * 0.42;
        
        const snowGeoKey = `snowGeo_${bearing}_${spread}_${height}_${isSelected}_${i}_v2`;
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
        snow.position.set(X, peakHeight - snowHeight * 0.58 - deltaY, Z);
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

export const createUnfoundPlaceholder = (type, themeName = 'dark', isSelected = false, bearing = 0, spread = 1.5, path = null, centerLat = 0, centerLng = 0, groupScale = 9.2) => {
  const group = new THREE.Group();
  
  if (type === 'mountain' || type === 'mountain_range') {
    const isBlackoutSelected = themeName === 'blackout' && isSelected;
    const colorKey = `${themeName}_${isSelected ? 'selPlaceholder' : 'unfoundPlaceholder'}`;
    const mat = getMaterial(colorKey + 'MatSolid', () => new THREE.MeshBasicMaterial({
      color: isBlackoutSelected ? 0xffffff : (isSelected ? 0x34d399 : 0x64748b),
      transparent: true,
      opacity: isBlackoutSelected ? 0.42 : (isSelected ? 0.45 : 0.3),
      wireframe: isBlackoutSelected
    }));

    if (path && Array.isArray(path) && path.length > 0) {
      const N = Math.max(10, Math.round(spread * 4.5));
      for (let i = 0; i < N; i++) {
        const tNorm = (N > 1) ? (i / (N - 1)) : 0.5;
        const [pLat, pLng] = interpolatePath(path, tNorm);

        // Convert coordinates to exact Three.js units on a sphere of radius 100
        const R = 100;
        const latRad = pLat * Math.PI / 180;
        const dx = R * Math.cos(latRad) * (pLng - centerLng) * (Math.PI / 180);
        const dz = R * (pLat - centerLat) * (Math.PI / 180);

        // Divide by groupScale to get local coordinates inside the scaled group
        const localX = dx / groupScale;
        const localZ = -dz / groupScale;

        // Curvature correction
        const dWorld = Math.sqrt(localX * localX + localZ * localZ) * groupScale;
        const deltaYWorld = R - Math.sqrt(Math.max(0.1, R * R - dWorld * dWorld));
        const deltaY = deltaYWorld / groupScale;

        const t = tNorm - 0.5;
        const bell = Math.cos(t * Math.PI);
        const randomHeightVar = 0.65 + ((Math.sin(i * 14.3) + 1) / 2) * 0.7;
        const peakHeight = 0.22 * bell * randomHeightVar;
        const peakRadius = peakHeight * 0.45;

        const peakGeoKey = `unfoundPeakGeo_${centerLat}_${centerLng}_${i}_v2`;
        const geo = getGeometry(peakGeoKey, () => new THREE.ConeGeometry(peakRadius, peakHeight, 5));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(localX, peakHeight / 2 - deltaY, localZ);
        group.add(mesh);
      }
    } else {
      const N = Math.max(10, Math.round(spread * 4.5));
      const R = 100;
      const spreadWorld = R * spread * (Math.PI / 180);
      const localSpread = spreadWorld / groupScale;
      const rad = (bearing || 0) * Math.PI / 180;
      const dx = Math.cos(rad);
      const dz = Math.sin(rad);

      for (let i = 0; i < N; i++) {
        const tNorm = (N > 1) ? (i / (N - 1)) : 0.5;
        const t = tNorm - 0.5;
        const bell = Math.cos(t * Math.PI);
        const randomHeightVar = 0.65 + ((Math.sin(i * 14.3) + 1) / 2) * 0.7;
        const X = t * localSpread * dx;
        const Z = t * localSpread * dz;

        // Curvature correction
        const dWorld = Math.sqrt(X * X + Z * Z) * groupScale;
        const deltaYWorld = R - Math.sqrt(Math.max(0.1, R * R - dWorld * dWorld));
        const deltaY = deltaYWorld / groupScale;

        const peakHeight = 0.22 * bell * randomHeightVar;
        const peakRadius = peakHeight * 0.45;

        const peakGeoKey = `unfoundPeakGeo_${bearing}_${spread}_${i}_v2`;
        const geo = getGeometry(peakGeoKey, () => new THREE.ConeGeometry(peakRadius, peakHeight, 5));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(X, peakHeight / 2 - deltaY, Z);
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
