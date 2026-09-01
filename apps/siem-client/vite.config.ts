import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      quoteStyle: "double",
      target: "react",
    }),
    svgr(),
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
    mkcert(),
    // checker({
    //  typescript: true,
    //  biome: true,
    // }),
    // visualizer({
    //  open: true,
    //  filename: `generated/stats-${Date.now()}.html`,
    //  gzipSize: true,
    //  brotliSize: true,
    // template: "treemap",
    //}),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    open: true,
    port: 3001,
    proxy: {
      "/api": {
        changeOrigin: true,
        secure: false,
        target: "http://localhost:8080",
        ws: true,
      },
    },
    strictPort: true,
  },
});
