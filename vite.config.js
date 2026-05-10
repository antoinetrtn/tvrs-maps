import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The globe renderer ships as a large pre-bundled vendor module. Keep the
    // app chunk small, and allow that isolated vendor chunk without warnings.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react';
          }
          if (
            id.includes('/three/') ||
            id.includes('/three-globe/') ||
            id.includes('/three-render-objects/') ||
            id.includes('/three-slippy-map-globe/')
          ) {
            return 'vendor-three';
          }
          if (
            id.includes('/react-globe.gl/') ||
            id.includes('/globe.gl/') ||
            id.includes('/kapsule/') ||
            id.includes('/d3-') ||
            id.includes('/h3-js/')
          ) {
            return 'vendor-globe';
          }
          return 'vendor';
        }
      }
    }
  }
})
