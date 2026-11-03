import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Don't crawl legacy/ for dependencies; the demo is the only page
  optimizeDeps: { entries: ["index.html"] },
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        fermi: resolve(import.meta.dirname, "src/fermi/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // three is a peer dependency; keep it (and its addons) out of the bundle
      external: [/^three($|\/)/],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
