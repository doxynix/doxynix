import { readFileSync } from "node:fs";

import fg from "fast-glob";
import { join } from "pathe";

const ROOT = join(import.meta.dirname, "..");
const PUBLIC_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PARSE_ERROR",
  "PAYMENT_REQUIRED",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
  "UNPROCESSABLE_CONTENT",
]);

// Billing and owned-subscription already expose stable client codes instead of English copy, and
// audit-logs/notifications are owned by other teams.
const files = await fg(["src/server/**/*.ts", "src/app/api/**/*.ts"], {
  absolute: true,
  cwd: ROOT,
  ignore: [
    "**/*.test.ts",
    "src/app/api/webhooks/**",
    "src/server/modules/audit-logs/**",
    "src/server/modules/billing/**",
    "src/server/modules/notifications/**",
    "src/server/modules/users/owned-subscription.ts",
    "src/server/modules/analysis/engine/**",
  ],
});

const errors: string[] = [];
const throwRe = /new (?:TRPCError|AppError)\(\{([\s\S]*?)\n\s*\}\)/g;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  let match = throwRe.exec(source);

  while (match != null) {
    const block = match[1] ?? "";
    const code = /code:\s*"([A-Z_]+)"/.exec(block)?.[1];

    if (code != null && PUBLIC_CODES.has(code) && !block.includes("messageCode:")) {
      const line = source.slice(0, match.index).split("\n").length;
      errors.push(`${file}:${line} — public ${code} without messageCode`);
    }

    match = throwRe.exec(source);
  }
}

const en = JSON.parse(readFileSync(join(ROOT, "messages", "en.json"), "utf8")) as {
  Errors: Record<string, string>;
};
const keySource = readFileSync(join(ROOT, "src/shared/i18n/use-error-message.ts"), "utf8");
const codeRe = /^\s+([A-Z][A-Z0-9_]*): "([a-z0-9_]+)",$/gm;
let entry = codeRe.exec(keySource);

while (entry != null) {
  const [, , key] = entry;
  if (key != null && !(key in en.Errors)) {
    errors.push(`use-error-message.ts — code ${entry[1]} maps to missing key Errors.${key}`);
  }
  entry = codeRe.exec(keySource);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.info(`check-message-codes: ${files.length} files OK`);
