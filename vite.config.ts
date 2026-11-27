import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The demo is the only page: don't crawl the other folders for dependencies
  optimizeDeps: { entries: ["index.html"] },
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        react: resolve(import.meta.dirname, "react/index.ts"),
        // The stylesheet, with its @imports (the guards' CSS) inlined
        style: resolve(import.meta.dirname, "src/style.css"),
      },
      formats: ["es"],
    },
    cssCodeSplit: true, // allows the CSS entry above
    rollupOptions: {
      // Peer dependencies: three (and its addons) and React stay out of the bundle
      external: [/^three($|\/)/, /^react($|\/)/, /^react-dom($|\/)/],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
