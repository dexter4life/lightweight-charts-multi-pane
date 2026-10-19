import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  css: { modules: { localsConvention: "camelCaseOnly" } },
  resolve: {
    alias: {
      // Resolve the sticker package from source so its rlottie worker URL resolves.
      "@ui/Sticker": fileURLToPath(new URL("../../ui-sdk/Sticker/src/index.ts", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5180, host: true, fs: { allow: ["../../.."] } },
});
