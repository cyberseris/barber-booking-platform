import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Plain Vite + React single-page app. `vite build` emits a fully static
// bundle to dist/ — no SSR, no server entry, no platform adapter.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Honours the "@/*" -> "./src/*" mapping in tsconfig.json.
    tsconfigPaths: true,
  },
  server: {
    host: true,
    port: 8080,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
