import { brand } from "./colors";

export type DateInput = string | Date | number | null | undefined;

const esc = String.raw`\x1B`;
const ANSI_REGEX = new RegExp(String.raw`${esc}(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])`, "g");

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const WIDE_REGEX =
  /[\p{Extended_Pictographic}\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFF01-\uFF60\uFFE0-\uFFE6]/u;

export function getStringWidth(text: string): number {
  const clean = stripAnsi(text);
  let width = 0;
  for (const { segment } of segmenter.segment(clean)) {
    if (segment === "\uFE0E" || segment === "\uFE0F") {
      continue;
    }
    width += WIDE_REGEX.test(segment) ? 2 : 1;
  }
  return width;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(dateInput: DateInput): string {
  if (!dateInput) {
    return brand.muted("—");
  }
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return brand.muted("—");
  }

  const diffSec = Math.round((time - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 45) {
    return "just now";
  }
  if (absSec < 3600) {
    return rtf.format(Math.round(diffSec / 60), "minute");
  }
  if (absSec < 86_400) {
    return rtf.format(Math.round(diffSec / 3600), "hour");
  }
  if (absSec < 2_592_000) {
    return rtf.format(Math.round(diffSec / 86_400), "day");
  }

  return formatDate(date);
}

const ENTITIES: Record<string, string> = {
  "&#39;": "'",
  "&amp;": "&",
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": '"',
};

const ALL_TAGS_REGEX = /<[^>]*>/g;

function stripAllTags(input: string): string {
  let current = input;
  while (true) {
    const next = current.replaceAll(ALL_TAGS_REGEX, "");
    if (next === current) {
      return next;
    }
    current = next;
  }
}

export function stripHtml(html: string): string {
  const withoutBr = html.replaceAll(/<br\s*\/?>|<\/(?:p|div)>/gi, "\n");
  const withoutTags = stripAllTags(withoutBr);

  const decoded = withoutTags.replaceAll(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, (match) => {
    const lower = match.toLowerCase();
    if (ENTITIES[lower]) {
      return ENTITIES[lower];
    }
    if (lower.startsWith("&#x")) {
      const code = Number.parseInt(match.slice(3, -1), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (lower.startsWith("&#")) {
      const code = Number.parseInt(match.slice(2, -1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return match;
  });

  return stripAllTags(decoded).trim();
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return brand.muted("—");
  }
  if (score >= 80) {
    return brand.success(`${score}/100`);
  }
  if (score >= 50) {
    return brand.warning(`${score}/100`);
  }
  return brand.error(`${score}/100`);
}

export function getScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return brand.muted("No data");
  }
  if (score >= 80) {
    return brand.success("Excellent");
  }
  if (score >= 50) {
    return brand.warning("Needs Attention");
  }
  return brand.error("Critical");
}

export function formatDateTime(dateInput: DateInput): string {
  if (!dateInput) {
    return brand.muted("—");
  }
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return brand.muted("—");
  }
  return date.toLocaleString();
}

export function formatDate(dateInput: DateInput): string {
  if (!dateInput) {
    return brand.muted("—");
  }
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return brand.muted("—");
  }
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function parseDateArg(value: string | undefined): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}
