import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  css: { modules: { localsConvention: "camelCaseOnly" } },
  resolve: {
    alias: {
      // Resolve the sticker package from source so its rlottie worker URL resolves.
      "@ui/Sticker": fromHere("../ui-sdk/Sticker/src/index.ts"),
      // The app consumes this package's own bundle, which npm cannot link to itself.
      "lightweight-charts-multi-pane": fromHere(
        `./dist/lightweight-charts.${mode === "production" ? "production" : "development"}.mjs`,
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  // The package root also holds examples, docs and a storybook build with their own HTML.
  optimizeDeps: { entries: ["index.html"] },
  // Keep the app build out of dist/, which holds the library bundle.
  build: { outDir: "dist-app" },
  server: { port: 5180, host: true, fs: { allow: ["../.."] } },
}));
