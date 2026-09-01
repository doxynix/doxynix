import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  process.exit(0);
}

let hasErrors = false;

const rules = [
  {
    check: (fileMatch: RegExpMatchArray, importPath: string) => {
      const targetMatch = new RegExp(/^client\/src\/features\/([^/]+)/).exec(importPath);
      return !targetMatch || targetMatch[1] === fileMatch[1];
    },
    comment:
      "Feature-to-feature imports are strictly forbidden. Features must remain completely isolated.",
    filePattern: /^client\/src\/features\/([^/]+)/,
    name: "fsd-cross-feature-imports",
  },
  {
    check: (_: RegExpMatchArray, importPath: string) => {
      return !/^client\/src\/(entities|features|widgets|pages|processes)/.test(importPath);
    },
    comment: "FSD layer hierarchy violation: lower layers cannot import from upper layers.",
    filePattern: /^client\/src\/shared/,
    name: "fsd-layer-order",
  },
  {
    check: (_: RegExpMatchArray, importPath: string) => {
      return !/^client\/src\/(features|widgets|pages|processes)/.test(importPath);
    },
    comment:
      "Entities represent pure business data structures and cannot import features/widgets/pages.",
    filePattern: /^client\/src\/entities/,
    name: "fsd-entities-cannot-import-features",
  },
  {
    check: (fileMatch: RegExpMatchArray, importPath: string) => {
      const targetMatch = new RegExp(/^server\/src\/modules\/([^/]+)/).exec(importPath);
      return !targetMatch || targetMatch[1] === fileMatch[1];
    },
    comment: "Vertical slices on the backend must be completely isolated from each other.",
    filePattern: /^server\/src\/modules\/([^/]+)/,
    name: "vsa-slices-isolation",
  },
  {
    check: (_: RegExpMatchArray, importPath: string) => {
      if (/^server\/src\/.+/.test(importPath)) {
        return importPath === "server/src/index" || importPath === "server/src/index.ts";
      }
      return true;
    },
    comment: "Client can only import types from server root index.ts.",
    filePattern: /^client\/src/,
    name: "no-deep-server-imports-from-client",
  },
  {
    check: (_: RegExpMatchArray, importPath: string) => {
      return !/^(client|server)\/src/.test(importPath);
    },
    comment: "The shared package must remain pure and cannot import client or server code.",
    filePattern: /^shared\/src/,
    name: "shared-package-must-be-pure",
  },
];

const IMPORT_EXPORT_REGEX = /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

for (const file of files) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) {
    continue;
  }

  try {
    const rawContent = readFileSync(file, "utf8");

    const cleanContent = rawContent.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*/g, "");

    for (const rule of rules) {
      const fileMatch = file.match(rule.filePattern);
      if (!fileMatch) {
        continue;
      }

      const matches = cleanContent.matchAll(IMPORT_EXPORT_REGEX);

      for (const match of matches) {
        let importPath = match[1];
        if (!importPath) {
          continue;
        }

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
if (hasErrors) {
  process.exit(1);
}
process.exit(0);
