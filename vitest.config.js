import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

import { globeAliases } from "./vite.config.js";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: globeAliases },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "tests/**"],
  },
});
