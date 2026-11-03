import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// bz-visualizer is used from source (../src) until it is published; then
// replace these aliases with the npm package.
const lib = (path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^bz-visualizer\/style\.css$/, replacement: lib("style.css") },
      { find: /^bz-visualizer$/, replacement: lib("index.ts") },
    ],
    // The library source imports three; use this app's copy
    dedupe: ["three"],
  },
  server: { fs: { allow: [".."] } },
  optimizeDeps: {
    include: ["mc-react-header"],
    // Required to run wasm modules in dev mode for vite.
    exclude: ["@spglib/moyo-wasm"],
  },
});
