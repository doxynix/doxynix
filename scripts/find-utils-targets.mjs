import { normalize } from "pathe";
import { Project, SyntaxKind } from "ts-morph";

async function run() {
  console.log("Analyzing codebase for refactoring targets...");

  const project = new Project({
    tsConfigFilePath: "tsconfig.json",
  });

  const sourceFiles = project.getSourceFiles("src/**/*.ts{,x}");

  let pathTargets = 0;
  let lodashTargets = 0;
  let filterTargets = 0;

  for (const sourceFile of sourceFiles) {
    const filePath = normalize(sourceFile.getFilePath());

    if (filePath.includes("node_modules") || filePath.includes("prisma/generated")) {
      continue;
    }

    const pathImports = sourceFile.getImportDeclarations().filter((imp) => {
      const mod = imp.getModuleSpecifierValue();
      return mod === "path" || mod === "node:path";
    });

    if (pathImports.length > 0) {
      pathTargets++;
      console.log(`\x1b[33m[path -> pathe]\x1b[0m ${filePath}`);
    }

    const legacyImports = sourceFile.getImportDeclarations().filter((imp) => {
      const mod = imp.getModuleSpecifierValue();
      return ["lodash", "lodash-es", "underscore", "ramda"].includes(mod);
    });

    if (legacyImports.length > 0) {
      lodashTargets++;
      console.log(`\x1b[36m[lodash -> es-toolkit]\x1b[0m ${filePath}`);
    }

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const text = node.getText();

        if (text.includes(".filter") && text.includes("indexOf")) {
          filterTargets++;
          const line = node.getStartLineNumber();
          console.log(
            `\x1b[31m[filter -> uniq]\x1b[0m ${filePath}:${line} - \x1b[2m${text.slice(0, 80)}...\x1b[0m`
          );
        }
      }
    });
  }

  console.log("\n==========================================");
  console.log(`Scan completed successfully!`);
  console.log(`- Native path imports found: ${pathTargets}`);
  console.log(`- Legacy Lodash/Ramda imports found: ${lodashTargets}`);
  console.log(`- Manual unique filters found: ${filterTargets}`);
  console.log("==========================================");
}

void run();
