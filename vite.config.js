import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const fromRoot = (p) => fileURLToPath(new URL(p, import.meta.url));

// Memoized triangulation for three-globe polygons (see the module header of
// src/globe/render/cachedConicPolygonGeometry.js). Shared with vitest.config.js.
export const globeAliases = [
  {
    find: /^three-conic-polygon-geometry$/,
    replacement: fromRoot("./src/globe/render/cachedConicPolygonGeometry.js"),
  },
  {
    find: /^three-conic-polygon-geometry-original$/,
    replacement: fromRoot(
      "./node_modules/three-conic-polygon-geometry/dist/three-conic-polygon-geometry.mjs"
    ),
  },
];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: globeAliases },
  build: {
    // The globe renderer ships as a large pre-bundled vendor module. Keep the
    // app chunk small, and allow that isolated vendor chunk without warnings.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "vendor-react";
          }
          if (
            id.includes("/three/") ||
            id.includes("/three-globe/") ||
            id.includes("/three-render-objects/") ||
            id.includes("/three-slippy-map-globe/")
          ) {
            return "vendor-three";
          }
          if (
            id.includes("/react-globe.gl/") ||
            id.includes("/globe.gl/") ||
            id.includes("/kapsule/") ||
            id.includes("/d3-") ||
            id.includes("/h3-js/")
          ) {
            return "vendor-globe";
          }
          return "vendor";
        },
      },
    },
  },
});
