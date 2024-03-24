import { defineConfig } from "vite";
import { libInjectCss } from "vite-plugin-lib-inject-css";

export default defineConfig({
  plugins: [libInjectCss()],
  build: {
    outDir: "dist",
    lib: {
      entry: ["./src/bzvisualizer/main.js"],
      formats: ["es"],
    },
  },
});
