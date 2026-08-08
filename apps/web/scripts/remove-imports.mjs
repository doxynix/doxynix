import { Project } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("src/server/**/*.{ts,tsx}");

console.log(`☢️  NUCLEAR WIPE: Removing ALL imports from ${sourceFiles.length} files...`);

for (const sourceFile of sourceFiles) {
  const imports = sourceFile.getImportDeclarations();

  if (imports.length === 0) continue;

  imports.forEach((imp) => imp.remove());

  try {
    sourceFile.fixMissingImports();

    sourceFile.organizeImports();

    sourceFile.saveSync();
    console.log(`✅ Re-generated all imports for: ${sourceFile.getFilePath()}`);
  } catch (error) {
    console.error(`❌ Failed to fix imports for ${sourceFile.getFilePath()}:`, error);
  }
}

console.log("\n🚀 WIPE COMPLETE.");
console.log(
  "⚠️  IMPORTANT: Some ambiguous imports (like 'Config' or 'User') might need manual selection."
);
console.log("👉 Run 'pnpm typecheck' now.");
