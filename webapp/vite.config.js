import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// bz-visualizer is used from source (../src, ../react) until it is
// published; then replace these aliases with the npm package.
const lib = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^bz-visualizer\/style\.css$/,
        replacement: lib("src/style.css"),
      },
      { find: /^bz-visualizer\/react$/, replacement: lib("react/index.ts") },
      { find: /^bz-visualizer$/, replacement: lib("src/index.ts") },
    ],
    // The library source imports three and React; use this app's copies
    dedupe: ["three", "react", "react-dom"],
  },
  server: { fs: { allow: [".."] } },
  optimizeDeps: {
    include: ["mc-react-header"],
    // Required to run wasm modules in dev mode for vite.
    exclude: ["@spglib/moyo-wasm"],
  },
});
