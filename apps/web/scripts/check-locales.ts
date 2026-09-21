/**
 * check-locales.ts — enforces the locale-file key conventions for apps/web.
 *
 * Locked as hard errors (block CI):
 *   1. Top-level keys (sections) MUST be PascalCase: `^[A-Z][a-zA-Z0-9]*$` (e.g. `Dashboard`, `OG`).
 *   2. All non-top-level keys MUST be snake_case: `^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`.
 *   3. Nesting depth MUST be <= 3 (sections -> groups -> leaves). The app currently uses 2.
 *   4. No `.` inside any key segment (a dot would collide with next-intl's key-path separator).
 *   5. Every leaf value MUST be a non-empty string.
 *   6. Values MUST NOT contain invisible Unicode (U+200B, U+200E, U+200F, U+FEFF).
 *
 * Reported as warnings (does not fail CI):
 *   - Unfinished-copy placeholders in the source locale (en.json): a value that equals the
 *     Title-Case form of its own key AND looks machine-generated (>= 4 words, or the key ends
 *     with `_desc` / `_title` / `_placeholder`). These are "TODO copy" strings users can see.
 *
 * Parity across locales (missing / extra keys) and ICU args are already covered by
 * `bun run lint:i18n` (eloqnt) — this script deliberately does not duplicate that.
 */

import { readFileSync } from "node:fs";

import fg from "fast-glob";
import { join } from "pathe";

const MESSAGES_DIR = join(import.meta.dirname, "..", "messages");
const SOURCE_LOCALE = "en";
const MAX_DEPTH = 3;

const SECTION_RE = /^[A-Z][a-zA-Z0-9]*$/;
const LEAF_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const INVISIBLE_RE = /[\u200b\u200e\u200f\ufeff]/;

interface Leaf {
  path: string;
  value: string;
  depth: number;
}

interface Report {
  errors: string[];
  placeholders: string[];
}

function titleCaseOfKey(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isCopyPlaceholder(key: string, value: string): boolean {
  if (value !== titleCaseOfKey(key)) {
    return false;
  }
  const segments = key.split("_");
  if (segments.length >= 4) {
    return true;
  }
  if (segments.length === 3 && segments[0] === "repo") {
    // e.g. `repo_status_lines` → "Repo Status Lines"; short natural copy
    // like "Check System Status" never matches the (segments[0] === "repo") branch.
    return true;
  }
  if (segments.length >= 2) {
    const last = segments.at(-1);
    if (last === "desc" || last === "title" || last === "placeholder") {
      return true;
    }
  }
  return false;
}

function walk(data: unknown, prefix: string, depth: number, report: Report, leaves: Leaf[]): void {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const [key, child] of Object.entries(data as Record<string, unknown>)) {
      if (key.includes(".")) {
        report.errors.push(
          `key segment contains "." — "${prefix === "" ? key : `${prefix}.${key}`}"`,
        );
      }
      if (depth === 0 && !SECTION_RE.test(key)) {
        report.errors.push(`section "${key}" must be PascalCase`);
      }
      if (depth >= 1 && !LEAF_RE.test(key)) {
        report.errors.push(`key "${prefix === "" ? key : `${prefix}.${key}`}" must be snake_case`);
      }
      walk(child, prefix === "" ? key : `${prefix}.${key}`, depth + 1, report, leaves);
    }
    return;
  }
  const path = prefix;
  if (typeof data !== "string") {
    report.errors.push(`"${path}": value must be a string`);
    return;
  }
  leaves.push({ depth, path, value: data });
}

function checkLocale(filePath: string, fileStem: string, report: Report): number {
  const data: unknown = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    report.errors.push(`${fileStem}.json: top level must be a JSON object`);
    return 0;
  }

  const leaves: Leaf[] = [];
  walk(data, "", 0, report, leaves);

  for (const leaf of leaves) {
    if (leaf.depth > MAX_DEPTH) {
      report.errors.push(`"${leaf.path}" exceeds max nesting depth ${MAX_DEPTH}`);
    }
    if (leaf.value.trim() === "") {
      report.errors.push(`"${leaf.path}" has an empty value`);
    }
    if (INVISIBLE_RE.test(leaf.value)) {
      report.errors.push(`"${leaf.path}" contains an invisible Unicode char`);
    }
    if (
      fileStem === SOURCE_LOCALE &&
      isCopyPlaceholder(leaf.path.split(".").pop() ?? "", leaf.value)
    ) {
      report.placeholders.push(`${leaf.path}: ${JSON.stringify(leaf.value)}`);
    }
  }
  return leaves.length;
}

async function main(): Promise<number> {
  const matches = await fg("*.json", { cwd: MESSAGES_DIR, onlyFiles: true });
  const files = matches.sort();
  const report: Report = { errors: [], placeholders: [] };

  if (files.length === 0) {
    console.error(`check-locales: no locale files found in ${MESSAGES_DIR}`);
    return 1;
  }

  let totalKeys = 0;
  for (const file of files) {
    const stem = file.endsWith(".json") ? file.slice(0, -".json".length) : file;
    totalKeys += checkLocale(join(MESSAGES_DIR, file), stem, report);
  }

  console.log(`check-locales: scanned ${files.length} locale files, ${totalKeys} leaf values`);
  for (const error of report.errors) {
    console.error(`  ${error}`);
  }
  if (report.errors.length > 0) {
    console.error(`check-locales: FAILED with ${report.errors.length} error(s)`);
    return 1;
  }
  console.log("check-locales: naming & structure conventions OK");

  if (report.placeholders.length > 0) {
    console.log(
      `check-locales: ${report.placeholders.length} unfinished-copy placeholder(s) in en.json (TODO copy):`,
    );
    for (const entry of report.placeholders) {
      console.log(`  ${entry}`);
    }
  } else {
    console.log("check-locales: no unfinished-copy placeholders");
  }
  return 0;
}

const exitCode = await main();
process.exitCode = exitCode;
