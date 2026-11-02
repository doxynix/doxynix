import { execFileSync, spawn } from "node:child_process";

const SEMGREP_VERSION = "1.182.1";
const RULES_DIR = ".semgrep/rules";

// Rules dropped for the whole repo. Per-file decisions live in .semgrep/rules/.
const EXCLUDED_RULES = [
  "generic.secrets.security.detected-jwt-token.detected-jwt-token",
  "generic.secrets.security.detected-stripe-api-key.detected-stripe-api-key",
  "javascript.audit.detect-replaceall-sanitization.detect-replaceall-sanitization",
  "javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp",
  "package_managers.bun.bun-missing-minimum-release-age.bun-missing-minimum-release-age",
  "package_managers.renovate.renovate-missing-minimum-release-age.renovate-missing-minimum-release-age",
  "typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml",
];

const BASE_ARGS = [
  "--config",
  "p/default",
  "--config",
  RULES_DIR,
  "--no-rewrite-rule-ids",
  "--metrics",
  "off",
  "--max-target-bytes",
  "500000",
  "--error",
  ...EXCLUDED_RULES.flatMap((rule) => ["--exclude-rule", rule]),
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertInstalledVersion(): void {
  let installed: string;

  try {
    installed = execFileSync("semgrep", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    fail(
      [
        `semgrep is not installed. CI pins ${SEMGREP_VERSION}.`,
        `  pipx install "semgrep==${SEMGREP_VERSION}"`,
        `  uv tool install "semgrep==${SEMGREP_VERSION}"`,
      ].join("\n"),
    );
  }

  if (installed !== SEMGREP_VERSION) {
    fail(
      `semgrep ${installed} is installed, but CI pins ${SEMGREP_VERSION}.\n` +
        `  pipx install --force "semgrep==${SEMGREP_VERSION}"`,
    );
  }
}

function baselineCommit(): string {
  const fromEnv = process.env.SEMGREP_BASELINE?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  try {
    return execFileSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf8" }).trim();
  } catch {
    return fail("Cannot compute the merge base against origin/main. Run `git fetch origin main`.");
  }
}

assertInstalledVersion();

const argv = process.argv.slice(2);
const wantsDiff = argv.includes("--diff");
const passthrough = argv.filter((arg) => arg !== "--diff" && arg !== "--test");

const args = argv.includes("--test")
  ? ["--test", RULES_DIR]
  : [
      "scan",
      ...BASE_ARGS,
      ...(wantsDiff ? ["--baseline-commit", baselineCommit()] : []),
      ...passthrough,
      ".",
    ];

const child = spawn("semgrep", args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
