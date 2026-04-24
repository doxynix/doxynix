/* eslint-disable sonarjs/slow-regex */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { sync } from "fast-glob";

const barrelMap = {};
const layers = ["features", "entities", "widgets", "shared"];

layers.forEach((layer) => {
  const patterns = [`src/${layer}/**/index.ts` || `src/${layer}/**/index.tsx`];
  const indexes = sync(patterns, { onlyFiles: true });

  indexes.forEach((indexPath) => {
    try {
      const content = readFileSync(indexPath, "utf8");
      const dir = dirname(indexPath);

      const barrelKey = indexPath
        .replace("src/", "@/")
        .replace("/index.ts", "")
        .replace("/index.tsx", "");

      barrelMap[barrelKey] = {};

      const namedExportRegex =
        /export\s+(?:type\s+)?\{\s*([\s\S]*?)\s*\}\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = namedExportRegex.exec(content)) !== null) {
        const specifiers = match[1].split(",");
        const relativePath = match[2];
        specifiers.forEach((spec) => {
          const trimmed = spec.trim();
          if (!trimmed) return;
          const [realName, aliasName] = trimmed.split(/\s+as\s+/);
          const exportName = (aliasName || realName).trim();

          let targetPath = join(dir, relativePath).replace(/\\/g, "/").replace("src/", "@/");
          barrelMap[barrelKey][exportName] = targetPath;
        });
      }
    } catch (e) {
      console.error(`[Error] Не удалось прочитать индекс: ${indexPath}`, e);
    }
  });
});

export default function barrelTransformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let changed = false;

  root.find(j.ImportDeclaration).forEach((p) => {
    const source = p.value.source.value;

    if (barrelMap[source]) {
      const specifiers = p.value.specifiers;
      const newImportsMap = new Map();

      specifiers.forEach((spec) => {
        if (spec.type === "ImportSpecifier") {
          const importedName = spec.imported.name;
          const localName = spec.local.name;
          const realPath = barrelMap[source][importedName];

          if (realPath) {
            if (!newImportsMap.has(realPath)) newImportsMap.set(realPath, []);
            newImportsMap
              .get(realPath)
              .push(j.importSpecifier(j.identifier(importedName), j.identifier(localName)));
          } else {
            if (!newImportsMap.has(source)) newImportsMap.set(source, []);
            newImportsMap.get(source).push(spec);
          }
        } else {
          if (!newImportsMap.has(source)) newImportsMap.set(source, []);
          newImportsMap.get(source).push(spec);
        }
      });

      const newImportDeclarations = Array.from(newImportsMap.entries()).map(
        ([importPath, specs]) => {
          return j.importDeclaration(specs, j.literal(importPath));
        }
      );

      if (newImportDeclarations.length > 0) {
        const isActuallyChanged =
          newImportDeclarations.length !== 1 || newImportDeclarations[0].source.value !== source;
        if (isActuallyChanged) {
          j(p).replaceWith(newImportDeclarations);
          changed = true;
        }
      }
    }
  });

  return changed ? root.toSource({ quote: "double", trailingComma: true }) : null;
}
