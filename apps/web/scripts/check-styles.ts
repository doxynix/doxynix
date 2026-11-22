import { Glob } from "bun";

import { relative } from "pathe";

const ROOT = new URL("../src", import.meta.url).pathname;

const MARKETING = (file: string) =>
  file.startsWith("widgets/landing/") ||
  file.startsWith("widgets/welcome-flow/") ||
  file.startsWith("shared/ui/visuals/") ||
  file.includes("(public)") ||
  file.startsWith("features/auth/") ||
  file.endsWith("not-found.tsx") ||
  file.endsWith("opengraph-image.tsx");

const PAGE_TITLE = /text-(?:2xl|3xl|4xl|5xl|6xl|metric)/;
const ALLOWED_Z = new Set(["z-0", "z-10", "z-20", "z-50", "z-100", "z-[9999]"]);

type Rule = {
  accept?: (value: string) => boolean;
  id: string;
  message: string;
  pattern: RegExp;
  skipFile?: (file: string) => boolean;
  skipLine?: (line: string) => boolean;
};

const RULES: readonly Rule[] = [
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
  {
    id: "arbitrary-radius",
    message: "Use a radius token. Literal px/rem radii are not part of the scale.",
    pattern: /rounded-\[[0-9.]+(?:px|rem|em)\]/g,
  },
  {
    id: "shadow-outside-landing",
    message:
      "Only landing visuals may use shadows. Product surfaces separate with border and tone.",
    pattern: /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/g,
    skipFile: (file) =>
      file.startsWith("widgets/landing/") || file.startsWith("shared/ui/visuals/"),
  },
  {
    accept: (value) => ALLOWED_Z.has(value),
    id: "z-index",
    message: "Use z-0 / z-10 / z-20 / z-50 / z-100; z-[9999] is reserved for the agent handle.",
    pattern: /\bz-(?:\[[^\]]+\]|[0-9]+)(?![\w-])/g,
  },
  {
    id: "display-size",
    message: "text-4xl–text-6xl are marketing display sizes; product UI stops at text-3xl.",
    pattern: /\btext-(?:4xl|5xl|6xl)\b/g,
    skipFile: MARKETING,
  },
  {
    id: "font-weight",
    message: "700 is reserved for page titles. Use font-semibold in cards, rows and alerts.",
    pattern: /\bfont-bold\b/g,
    skipFile: MARKETING,
    skipLine: (line) => PAGE_TITLE.test(line) || line.includes("<h1"),
  },
  {
    id: "uppercase",
    message: "Do not uppercase labels; only brand abbreviations are allowed.",
    pattern: /\buppercase\b/g,
    skipFile: (file) => MARKETING(file) || file.endsWith(".test.ts") || file.endsWith(".test.tsx"),
  },
  {
    id: "gap-scale",
    message: "Use gap-1/2/3/4/6/8 in product layout.",
    pattern: /\bgap-(?:5|10|12)\b/g,
    skipFile: MARKETING,
  },
];

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
  const file = relative(ROOT, path);
  const content = await Bun.file(path).text();
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || line.includes("style-ok")) {
      return;
    }

    for (const rule of RULES) {
      if (rule.skipFile?.(file) === true || rule.skipLine?.(line) === true) {
        continue;
      }

      rule.pattern.lastIndex = 0;
      const matches = [...line.matchAll(rule.pattern)];

      for (const match of matches) {
        if (rule.accept?.(match[0]) === true) {
          continue;
        }

        violations.push({
          file,
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
