// Vite config — dev server with HMR + production build that inlines
// everything into a single self-contained HTML file.
//
// Source root is `src/` so index.html lives next to its imports. Build
// output goes to `dist/` at the project root. The viteSingleFile plugin
// inlines all JS, CSS, and assets so `dist/index.html` is shareable.

import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src",
  publicDir: false,
  base: "./",

  server: {
    port: 8000,
    strictPort: false,
    open: false,
  },

  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    minify: "esbuild",
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },

  plugins: [viteSingleFile()],
});
