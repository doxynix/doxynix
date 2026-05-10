import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const mode = process.argv[2] || "standard";

const project = new Project({
  tsConfigFilePath: path.join(rootDir, "tsconfig.json"),
});

console.log("\x1b[36m%s\x1b[0m", `🔍 Doxynix Type Audit [MODE: ${mode.toUpperCase()}]`);

const sourceFiles = project.getSourceFiles();
const report = {
  CRITICAL: [], // as any, as unknown as Type
  DEBT: [],     // as User, as string
  INFO: [],     // as const, as Type
};

for (const sourceFile of sourceFiles) {
  const filePath = path.relative(rootDir, sourceFile.getFilePath());
  if (filePath.includes("node_modules") || filePath.includes(".next")) continue;

  const asExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);

  asExpressions.forEach((node) => {
    const text = node.getText();
    const targetType = node.getType().getText();
    const expressionText = node.getExpression().getText();
    const line = node.getStartLineNumber();

    if (text.endsWith("as const")) {
      if (mode === "full") {
        report.INFO.push({ file: filePath, line, text, reason: "Literal narrowing" });
      }
      return;
    }

    let severity = "DEBT";
    let reason = "Manual type assertion";

    if (targetType === "any" || text.includes("as any")) {
      severity = "CRITICAL";
      reason = "🚨 DANGEROUS ANY";
    } else if (expressionText.includes("as unknown") || expressionText.includes("as any")) {
      severity = "CRITICAL";
      reason = "🧪 DOUBLE CAST (Unsafe)";
    }
    else if (filePath.includes("server/") || filePath.includes("engine/")) {
      severity = "CRITICAL";
      reason = "🏗️ CORE LOGIC ASSERTION";
    }
    else if (filePath.includes("shared/ui") || filePath.includes("components/")) {
      severity = "INFO";
      reason = "🎨 UI/DOM Hint";
    }

    if (mode === "critical" && severity !== "CRITICAL") return;

    report[severity].push({ file: filePath, line, text, reason, targetType });
  });
}

const printCategory = (name, items, color) => {
  if (items.length === 0) return;
  console.log(`\n${color}=== ${name} (${items.length}) ===\x1b[0m`);
  items.forEach(item => {
    console.log(`\x1b[90m${item.file}:${item.line}\x1b[0m \x1b[32m[${item.reason}]\x1b[0m`);
    console.log(`  \x1b[33m${item.text}\x1b[0m\n`);
  });
};

printCategory("CRITICAL RISK", report.CRITICAL, "\x1b[41m\x1b[37m");
printCategory("TECHNICAL DEBT", report.DEBT, "\x1b[33m");
if (mode === "full") {
  printCategory("STYLE & UI HINTS", report.INFO, "\x1b[34m");
}

const total = report.CRITICAL.length + report.DEBT.length + (mode === "full" ? report.INFO.length : 0);
console.log("\x1b[36m%s\x1b[0m", `\nTotal issues to review: ${total}`);
