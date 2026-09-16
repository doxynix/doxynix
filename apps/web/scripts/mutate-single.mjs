import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webDir = path.resolve(__dirname, "..");

let [, , mutatePath, testPath] = process.argv;

if (!mutatePath || !testPath) {
  console.error("\x1b[31m%s\x1b[0m", "Error: Missing required file paths!");
  console.log("Usage:   bun apps/web/scripts/mutate-single.mjs <source-file> <test-file>");
  console.log(
    "Example: bun apps/web/scripts/mutate-single.mjs src/server/utils/array-utils.ts src/server/utils/array-utils.test.ts",
  );
  process.exit(1);
}

mutatePath = mutatePath.replace(/^apps\/web\//, "");
testPath = testPath.replace(/^apps\/web\//, "");

const fullMutatePath = path.resolve(webDir, mutatePath);
const fullTestPath = path.resolve(webDir, testPath);

if (!fs.existsSync(fullMutatePath)) {
  console.error(`\x1b[31mSource file not found: ${fullMutatePath}\x1b[0m`);
  process.exit(1);
}

if (!fs.existsSync(fullTestPath)) {
  console.error(`\x1b[31mTest file not found: ${fullTestPath}\x1b[0m`);
  process.exit(1);
}

const isWindows = process.platform === "win32";
const strykerBin = path.resolve(
  webDir,
  "node_modules",
  ".bin",
  isWindows ? "stryker.cmd" : "stryker",
);

if (!fs.existsSync(strykerBin)) {
  console.error(`\x1b[31mStryker binary not found at: ${strykerBin}\x1b[0m`);
  process.exit(1);
}

const tempConfigPath = path.resolve(webDir, ".stryker-single.tmp.json");

const singleConfig = {
  $schema: "https://schema.stryker-mutator.io/stryker-config.schema.json",
  commandRunner: {
    command: `bun x vitest run ${testPath} --config vitest.stryker.config.ts`,
  },
  concurrency: 2,
  coverageAnalysis: "off",
  disableTypeChecks: "src/**/*.{ts,tsx}",
  mutate: [mutatePath],
  reporters: ["progress", "clear-text", "html"],
  testRunner: "command",
};

fs.writeFileSync(tempConfigPath, JSON.stringify(singleConfig, null, 2), "utf8");

const args = ["run", tempConfigPath, "--inPlace"];

console.log(`🚀 Running targeted Stryker mutation test for: ${mutatePath}`);
console.log(`🎯 Test target file: ${testPath}`);

const strykerProcess = spawn(strykerBin, args, {
  cwd: webDir,
  shell: isWindows,
  stdio: "inherit",
});

const cleanup = () => {
  if (fs.existsSync(tempConfigPath)) {
    try {
      fs.unlinkSync(tempConfigPath);
    } catch {}
  }
};

strykerProcess.on("error", (err) => {
  cleanup();
  console.error("Failed to start Stryker process:", err.message);
  process.exit(1);
});

strykerProcess.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
