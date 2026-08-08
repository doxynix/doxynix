import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

let hasErrors = false;

const rules = [
  {
    name: "fsd-cross-feature-imports",
    comment:
      "Feature-to-feature imports are strictly forbidden. Features must remain completely isolated.",
    filePattern: /^client\/src\/features\/([^/]+)/,
    check: (fileMatch: RegExpMatchArray, importPath: string) => {
      const targetMatch = importPath.match(/^client\/src\/features\/([^/]+)/);
      return !targetMatch || targetMatch[1] === fileMatch[1];
    },
  },
  {
    name: "fsd-layer-order",
    comment: "FSD layer hierarchy violation: lower layers cannot import from upper layers.",
    filePattern: /^client\/src\/shared/,
    check: (_: RegExpMatchArray, importPath: string) => {
      return !/^client\/src\/(entities|features|widgets|pages|processes)/.test(importPath);
    },
  },
  {
    name: "fsd-entities-cannot-import-features",
    comment:
      "Entities represent pure business data structures and cannot import features/widgets/pages.",
    filePattern: /^client\/src\/entities/,
    check: (_: RegExpMatchArray, importPath: string) => {
      return !/^client\/src\/(features|widgets|pages|processes)/.test(importPath);
    },
  },
  {
    name: "vsa-slices-isolation",
    comment: "Vertical slices on the backend must be completely isolated from each other.",
    filePattern: /^server\/src\/modules\/([^/]+)/,
    check: (fileMatch: RegExpMatchArray, importPath: string) => {
      const targetMatch = importPath.match(/^server\/src\/modules\/([^/]+)/);
      return !targetMatch || targetMatch[1] === fileMatch[1];
    },
  },
  {
    name: "no-deep-server-imports-from-client",
    comment: "Client can only import types from server root index.ts.",
    filePattern: /^client\/src/,
    check: (_: RegExpMatchArray, importPath: string) => {
      if (/^server\/src\/.+/.test(importPath)) {
        return importPath === "server/src/index" || importPath === "server/src/index.ts";
      }
      return true;
    },
  },
  {
    name: "shared-package-must-be-pure",
    comment: "The shared package must remain pure and cannot import client or server code.",
    filePattern: /^shared\/src/,
    check: (_: RegExpMatchArray, importPath: string) => {
      return !/^(client|server)\/src/.test(importPath);
    },
  },
];

const IMPORT_EXPORT_REGEX = /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

for (const file of files) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;

  try {
    const rawContent = readFileSync(file, "utf8");

    const cleanContent = rawContent.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    for (const rule of rules) {
      const fileMatch = file.match(rule.filePattern);
      if (!fileMatch) continue;

      const matches = cleanContent.matchAll(IMPORT_EXPORT_REGEX);

      for (const match of matches) {
        let importPath = match[1];
        if (!importPath) continue;

        if (importPath.startsWith("@/")) {
          importPath = importPath.replace("@/", "client/src/");
        }

        const isValid = rule.check(fileMatch, importPath);

        if (!isValid) {
          console.error(`\n❌ Architecture Violation [${rule.name}]`);
          console.error(`   File: ${file}`);
          console.error(`   Forbidden Import: "${importPath}"`);
          console.error(`   Description: ${rule.comment}`);
          hasErrors = true;
        }
      }
    }
  } catch {
    // ignore removed files
  }
}
if (hasErrors) process.exit(1);
process.exit(0);
