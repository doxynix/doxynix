import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import mkcert from "vite-plugin-mkcert";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      quoteStyle: "double",
    }),
    svgr(),
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
    mkcert(),
    checker({
      typescript: true,
      biome: true,
    }),
  ],
  server: {
    port: 3001,
    strictPort: true,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
