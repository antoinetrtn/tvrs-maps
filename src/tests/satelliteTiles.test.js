import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { useSatelliteTileLayer } from "../globe/hooks/useSatelliteTileLayer";
import {
  createTileMesh,
  SATELLITE_TILE_MAX_LEVEL,
  SATELLITE_TILE_RADIUS,
  SATELLITE_TILE_URL,
  tileLevelForAltitude,
  visibleTiles,
} from "../globe/render/satelliteTiles";

describe("satelliteTiles", () => {
  describe("URL building", () => {
    it("exports SATELLITE_TILE_MAX_LEVEL as 8", () => {
      expect(SATELLITE_TILE_MAX_LEVEL).toBe(8);
    });

    it("builds the correct NASA GIBS WMTS URL with {z}/{y}/{x}.jpeg", () => {
      const url = SATELLITE_TILE_URL(5, 10, 12);
      expect(url).toBe(
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/5/12/10.jpeg"
      );
    });

    it("formats level 0 root tile URL correctly", () => {
      const url = SATELLITE_TILE_URL(0, 0, 0);
      expect(url).toBe(
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/0/0/0.jpeg"
      );
    });
  });

  describe("tileLevelForAltitude", () => {
    it("returns 0 when altitude >= 1.2 or invalid", () => {
      expect(tileLevelForAltitude(1.2)).toBe(0);
      expect(tileLevelForAltitude(1.5)).toBe(0);
      expect(tileLevelForAltitude(2.5)).toBe(0);
      expect(tileLevelForAltitude(NaN)).toBe(0);
      expect(tileLevelForAltitude(undefined)).toBe(0);
    });

    it("returns clamped levels between 3 and 8 when altitude < 1.2", () => {
      expect(tileLevelForAltitude(1.15)).toBe(3);
      expect(tileLevelForAltitude(1.0)).toBe(4);
      expect(tileLevelForAltitude(0.5)).toBe(5);
      expect(tileLevelForAltitude(0.25)).toBe(6);
      expect(tileLevelForAltitude(0.12)).toBe(7);
      expect(tileLevelForAltitude(0.05)).toBe(8);
      expect(tileLevelForAltitude(0.01)).toBe(8);
    });

    it("is monotonic as altitude decreases", () => {
      const altitudes = [1.19, 1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0.02];
      let previousLevel = 0;
      for (const alt of altitudes) {
        const level = tileLevelForAltitude(alt);
        expect(level).toBeGreaterThanOrEqual(3);
        expect(level).toBeLessThanOrEqual(8);
        expect(level).toBeGreaterThanOrEqual(previousLevel);
        previousLevel = level;
      }
    });
  });

  describe("visibleTiles", () => {
    it("returns empty array for level 0 or invalid inputs", () => {
      expect(visibleTiles({ lat: 0, lng: 0, altitude: 0.5 }, 0)).toEqual([]);
      expect(visibleTiles({ lat: 0, lng: 0, altitude: 0.5 }, -1)).toEqual([]);
    });

    it("wraps tile x across the antimeridian seamlessly", () => {
      const tiles = visibleTiles({ lat: 0, lng: 179.5, altitude: 0.4 }, 5);
      expect(tiles.length).toBeGreaterThan(0);

      const dim = 2 ** 5;
      const xIndices = new Set(tiles.map((t) => t.x));
      // Antimeridian is between x = dim - 1 (180W) and x = 0 (180E)
      expect(xIndices.has(dim - 1)).toBe(true);
      expect(xIndices.has(0)).toBe(true);

      tiles.forEach((t) => {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThan(dim);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThan(dim);
      });
    });

    it("clamps latitude to Web Mercator bounds without negative or out-of-range y", () => {
      const northTiles = visibleTiles({ lat: 89.0, lng: 0, altitude: 0.4 }, 5);
      expect(northTiles.length).toBeGreaterThan(0);
      northTiles.forEach((t) => {
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThan(32);
      });

      const southTiles = visibleTiles({ lat: -89.0, lng: 0, altitude: 0.4 }, 5);
      expect(southTiles.length).toBeGreaterThan(0);
      southTiles.forEach((t) => {
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThan(32);
      });
    });

    it("caps the result at 64 tiles maximum", () => {
      const tiles = visibleTiles({ lat: 0, lng: 0, altitude: 1.1 }, 6);
      expect(tiles.length).toBeLessThanOrEqual(64);
    });

    it("orders tiles closest to the centre first", () => {
      const center = { lat: 48.8566, lng: 2.3522, altitude: 0.3 };
      const tiles = visibleTiles(center, 5);
      expect(tiles.length).toBeGreaterThan(0);

      const firstTile = tiles[0];
      // Tile at level 5 containing Paris (lat 48.85, lng 2.35):
      // lonToTileX: (2.35 + 180) / 360 * 32 = 16.2 -> x=16
      expect(firstTile.x).toBe(16);
      expect(firstTile.y).toBe(10);
    });
  });

  describe("createTileMesh", () => {
    it("creates a spherical patch mesh with expected attributes and metadata", () => {
      const tile = { z: 4, x: 8, y: 5 };
      const texture = new THREE.Texture();
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const mesh = createTileMesh(tile, texture, material);

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.userData.tileKey).toBe("4/8/5");
      expect(mesh.renderOrder).toBe(0);
      expect(mesh.material).toBe(material);

      const geometry = mesh.geometry;
      const positionAttr = geometry.getAttribute("position");
      const uvAttr = geometry.getAttribute("uv");

      expect(positionAttr).toBeDefined();
      expect(uvAttr).toBeDefined();
      expect(geometry.getIndex()).toBeDefined();

      // 16x16 segments = 17x17 = 289 vertices
      expect(positionAttr.count).toBe(289);

      // Verify spherical radius ~ 100.02 for each vertex
      for (let i = 0; i < positionAttr.count; i++) {
        const x = positionAttr.getX(i);
        const y = positionAttr.getY(i);
        const z = positionAttr.getZ(i);
        const radius = Math.sqrt(x * x + y * y + z * z);
        expect(radius).toBeCloseTo(SATELLITE_TILE_RADIUS, 1);
      }

      // Verify UV mapping: v=1 at north (i=0), v=0 at south (i=16)
      expect(uvAttr.getY(0)).toBe(1);
      expect(uvAttr.getY(positionAttr.count - 1)).toBe(0);
      expect(uvAttr.getX(0)).toBe(0);
      expect(uvAttr.getX(positionAttr.count - 1)).toBe(1);
    });

    it("falls back to default MeshBasicMaterial when material is not supplied", () => {
      const tile = { z: 3, x: 2, y: 1 };
      const texture = new THREE.Texture();
      const mesh = createTileMesh(tile, texture);

      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(mesh.material.map).toBe(texture);
    });
  });

  describe("useSatelliteTileLayer", () => {
    it("is exported as a function", () => {
      expect(typeof useSatelliteTileLayer).toBe("function");
    });
  });
});
