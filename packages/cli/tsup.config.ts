import { defineConfig } from "tsup";

import pkg from "./package.json";

export default defineConfig({
  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);`,
  },
  clean: true,
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  entry: ["src/index.ts"],
  format: ["esm"],
  keepNames: true,
  metafile: true,
  minify: true,
  noExternal: [
    "@doxynix/shared",
    "@clack/prompts",
    "commander",
    "picocolors",
    "@trpc/client",
    "superjson",
  ],
  outDir: "dist",
  platform: "node",
  shims: true,
  sourcemap: false,
  target: "node18",
  treeshake: "smallest",
});
