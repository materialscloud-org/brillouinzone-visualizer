import { defineConfig } from "vite";

// One self-contained ES module (+ its CSS) for anywidget, written into the
// Python package. React and three are bundled, so the notebook needs nothing
// else. Not lib mode: that skips minifying, which only matters for libraries.
export default defineConfig({
  build: {
    outDir: "src/bz_widget/static",
    emptyOutDir: true,
    rollupOptions: {
      input: "js/widget.tsx",
      preserveEntrySignatures: "exports-only", // keep the default export
      output: { entryFileNames: "widget.js", assetFileNames: "widget[extname]" },
    },
  },
  // bz-visualizer is linked; use this folder's single copy of each
  resolve: { dedupe: ["react", "react-dom", "three"] },
});
