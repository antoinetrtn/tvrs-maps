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
  // three-globe hex layers are unused: drop the ~550 kB h3-js blob.
  { find: /^h3-js$/, replacement: fromRoot("./src/globe/render/h3Stub.js") },
  // Experimental WebGPU renderer flag (src/globe/render/globeRendererFlag.js).
  {
    find: /^three-render-objects$/,
    replacement: fromRoot("./src/globe/render/threeRenderObjectsShim.js"),
  },
  {
    find: /^three-render-objects-original$/,
    replacement: fromRoot("./node_modules/three-render-objects/dist/three-render-objects.mjs"),
  },
];

function devAssetsPlugin(isProd) {
  return {
    name: "tvrs-dev-assets",
    transformIndexHtml(html) {
      if (isProd) {
        return html;
      }
      return html
        .replace('href="/favicon.svg"', 'href="/favicon-dev.svg"')
        .replace('href="/icon-192.png"', 'href="/icon-192-dev.png"')
        .replace('href="/icon-512.png"', 'href="/icon-512-dev.png"')
        .replace('href="/apple-touch-icon.png"', 'href="/apple-touch-icon-dev.png"')
        .replace('href="/manifest.webmanifest"', 'href="/manifest-dev.webmanifest"');
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const deployEnv =
    process.env.VITE_DEPLOY_ENV ||
    process.env.VERCEL_ENV ||
    (mode === "development" ? "development" : "unknown");
  const gitRef = process.env.VERCEL_GIT_COMMIT_REF || process.env.VITE_GIT_REF || "";
  const isProd = deployEnv === "production";

  return {
    define: {
      "import.meta.env.VITE_DEPLOY_ENV": JSON.stringify(deployEnv),
      "import.meta.env.VITE_GIT_REF": JSON.stringify(gitRef),
    },
    plugins: [react(), devAssetsPlugin(isProd)],
    resolve: { alias: globeAliases },
    // Pre-bundle EffectComposer with globe.gl so the WebGPU shim patches the
    // same class instance in dev (one copy in production builds anyway).
    optimizeDeps: { include: ["three/examples/jsm/postprocessing/EffectComposer.js"] },
    build: {
      // The globe renderer ships as a large pre-bundled vendor module. Keep the
      // app chunk small, and allow that isolated vendor chunk without warnings.
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          chunkFileNames(chunkInfo) {
            if (
              chunkInfo.facadeModuleId &&
              /node_modules[\\/]@supabase[\\/]/.test(chunkInfo.facadeModuleId)
            ) {
              return "assets/vendor-supabase-[hash].js";
            }
            return "assets/[name]-[hash].js";
          },
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: (id) =>
                  id.includes("\0vite/preload-helper") ||
                  /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/.test(id),
                priority: 60,
              },
              {
                name: "vendor-three",
                test: (id) =>
                  /node_modules[\\/]three[\\/]/.test(id) && !/three\.(?:webgpu|tsl)/.test(id),
                priority: 50,
              },
              {
                name: "vendor-webgpu",
                test: /node_modules[\\/]three[\\/]build[\\/]three\.(?:webgpu|tsl)/,
                priority: 40,
              },
              {
                name: "vendor",
                test: (id) =>
                  /node_modules[\\/]/.test(id) &&
                  !/node_modules[\\/](?:@supabase|tslib|iceberg-js|base64-arraybuffer|ws|react-globe\.gl|globe\.gl|three-globe|three-render-objects|three-slippy-map-globe|three-conic-polygon-geometry|three-geojson-geometry|kapsule|float-tooltip|d3-|delaunator|robust-predicates|internmap|h3-js)[\\/]/.test(
                    id
                  ),
                priority: 20,
              },
              {
                name: "vendor-globe",
                test: /node_modules[\\/](?:react-globe\.gl|globe\.gl|three-globe|three-render-objects|three-slippy-map-globe|three-conic-polygon-geometry|three-geojson-geometry|kapsule|float-tooltip|d3-|delaunator|robust-predicates|internmap|h3-js)[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
  };
});
