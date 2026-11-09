import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Don't crawl legacy/ for dependencies; the demo is the only page
  optimizeDeps: { entries: ["index.html"] },
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        react: resolve(import.meta.dirname, "react/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // Peer dependencies: three (and its addons) and React stay out of the bundle
      external: [/^three($|\/)/, /^react($|\/)/, /^react-dom($|\/)/],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
