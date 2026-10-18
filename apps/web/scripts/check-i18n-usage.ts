import { readdirSync, readFileSync } from "node:fs";

import fg from "fast-glob";
import { join } from "pathe";

const ROOT = join(import.meta.dirname, "..");
const MESSAGES_DIR = join(ROOT, "messages");

// `check-locales` compares en.json against the other locales, so a key that no locale has
// passes it. This walks the other direction: every `t("key")` reachable from a
// `useTranslations("Ns")` binding must exist as `Ns.key` in every locale.
//
// Resolution mirrors next-intl exactly. `t` bound to "Dashboard" resolves `t("Common.copy")`
// as `Dashboard.Common.copy`, which is the mistake this exists to catch.

const BINDING_RE = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\(\s*"([A-Z][a-zA-Z0-9]*)"/g;
// The leading segment may be a PascalCase section (`t("Common.copy")`) — that spelling is exactly
// the bug this check exists for, so it has to be matched in order to be rejected, not skipped.
const CALL_RE =
  /\b([A-Za-z_$][\w$]*)\(\s*"((?:[A-Z][a-zA-Z0-9]*\.)?[a-z0-9_]+(?:_[a-z0-9_]+)*)"\s*[,)]/g;

type Reference = { binding: string; key: string; namespace: string; file: string };

function collectLeaves(node: unknown, prefix = "", out: Set<string> = new Set()): Set<string> {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return out;
  }

  for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
    if (typeof child === "object" && child !== null && !Array.isArray(child)) {
      collectLeaves(child, prefix === "" ? key : `${prefix}.${key}`, out);
    } else {
      out.add(prefix === "" ? key : `${prefix}.${key}`);
    }
  }

  return out;
}

const files = await fg(["src/**/*.{ts,tsx}"], { absolute: true, cwd: ROOT, onlyFiles: true });
const references: Reference[] = [];

for (const file of files) {
  const text = readFileSync(file, "utf-8");

  const bindings = new Map<string, string>();
  for (const match of text.matchAll(BINDING_RE)) {
    bindings.set(match[1], match[2]);
  }

  for (const match of text.matchAll(CALL_RE)) {
    const [, binding, key] = match;
    const namespace = bindings.get(binding);

    if (namespace == null) {
      // Not a `useTranslations` binding — `cn("absolute")`, `fetch("30d")` and friends land here.
      continue;
    }

    references.push({ binding, file, key, namespace });
  }
}

const localeFiles = readdirSync(MESSAGES_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();

const missingPerLocale = new Map<string, Set<string>>(
  localeFiles.map((name) => [name, new Set<string>()]),
);
const leavesPerLocale = new Map(
  localeFiles.map((name) => [
    name,
    collectLeaves(JSON.parse(readFileSync(join(MESSAGES_DIR, name), "utf-8"))),
  ]),
);

for (const reference of references) {
  const expected =
    reference.namespace === "" ? reference.key : `${reference.namespace}.${reference.key}`;

  for (const name of localeFiles) {
    if (!leavesPerLocale.get(name)?.has(expected)) {
      missingPerLocale.get(name)?.add(expected);
    }
  }
}

const failures = [...missingPerLocale.entries()].filter(([, keys]) => keys.size > 0);

console.log(
  `check-i18n-usage: ${references.length} bound references in ${files.length} files, ${localeFiles.length} locales`,
);

if (failures.length > 0) {
  for (const [name, keys] of failures) {
    console.error(`  ${name}: ${keys.size} missing -> ${[...keys].sort().join(", ")}`);
  }
  console.error(
    "check-i18n-usage: FAILED — every bound t(key) must resolve to <namespace>.<key> in every locale",
  );
  process.exitCode = 1;
} else {
  console.log("check-i18n-usage: every bound reference resolves in every locale");
}
