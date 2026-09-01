import { defineConfig } from "tsup";

export default defineConfig({
  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);`,
  },
  clean: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  minify: true,
  noExternal: [
    "@clack/prompts",
    "commander",
    "picocolors",
    "cli-table3",
    "@trpc/client",
    "superjson",
  ],
  outDir: "dist",
  platform: "node",
  shims: true,
  sourcemap: false,
  target: "node18",
});
