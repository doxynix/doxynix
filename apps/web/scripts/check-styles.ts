import { Glob } from "bun";

import { relative } from "pathe";

const ROOT = new URL("../src", import.meta.url).pathname;

const RULES = [
  {
    id: "arbitrary-font-size",
    message: "Use text-2xs / text-xs / text-sm / text-base / text-lg / text-xl / text-metric.",
    pattern: /text-\[[^\]]+\]/g,
  },
  {
    id: "raw-palette",
    message: "Use semantic tokens (success, warning, destructive, info, brand-*, chart-*).",
    pattern:
      /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/g,
  },
  {
    id: "tracking",
    message: "Letter spacing comes from the type scale. Do not add tracking utilities.",
    pattern: /(?:[a-z0-9-]+:)*tracking-(?:tighter|tight|normal|wide|wider|widest|\[[^\]]+\])/g,
  },
] as const;

type Violation = {
  file: string;
  line: number;
  rule: string;
  message: string;
  value: string;
};

const violations: Violation[] = [];

for await (const entry of new Glob("**/*.{ts,tsx}").scan({ cwd: ROOT })) {
  const path = `${ROOT}/${entry}`;
  const content = await Bun.file(path).text();
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || line.includes("style-ok")) {
      return;
    }

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const matches = [...line.matchAll(rule.pattern)];

      for (const match of matches) {
        violations.push({
          file: relative(ROOT, path),
          line: index + 1,
          message: rule.message,
          rule: rule.id,
          value: match[0],
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log("check-styles: OK");
  process.exit(0);
}

for (const violation of violations) {
  console.error(
    `${violation.file}:${violation.line}  ${violation.rule}  ${violation.value}\n  ${violation.message}`,
  );
}

console.error(`\ncheck-styles: ${violations.length} violation(s)`);
process.exit(1);
