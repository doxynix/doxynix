import { pc } from "./colors";

let inCodeBlock = false;

const BULLET_REGEX = /^([ \t]*)[*+-][ \t]+(.*)$/;
const NUM_LIST_REGEX = /^([ \t]*)(\d+\.)[ \t]+(.*)$/;

export function renderInlineMarkdown(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }
  return text
    .replaceAll(/`([^`]+)`/g, (_, code) => pc.yellow(code))
    .replaceAll(/\*\*([^*]+)\*\*/g, (_, bold) => pc.bold(bold))
    .replaceAll(/__([^_]+)__/g, (_, bold) => pc.bold(bold))
    .replaceAll(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, italic) => pc.italic(italic))
    .replaceAll(/(?<!_)_([^_]+)_(?!_)/g, (_, italic) => pc.italic(italic));
}

export function renderMarkdownLine(line: string): string | undefined {
  const trimmed = line.trim();

  if (trimmed.startsWith("```")) {
    inCodeBlock = !inCodeBlock;
    if (!inCodeBlock) {
      return pc.gray("└───\n");
    }
    const lang = trimmed.slice(3).trim();
    const langLabel = lang ? pc.cyan(lang) : "Code";
    return pc.gray(`\n┌── ${langLabel} ───`);
  }

  if (inCodeBlock) {
    return `${pc.gray("│")} ${pc.cyan(line)}`;
  }

  if (trimmed.startsWith("### ")) {
    return `\n${pc.bold(pc.cyan("▶ " + renderInlineMarkdown(trimmed.slice(4))))}`;
  }
  if (trimmed.startsWith("## ")) {
    return `\n${pc.bold(pc.magenta("━━━ " + renderInlineMarkdown(trimmed.slice(3)) + " ━━━"))}`;
  }
  if (trimmed.startsWith("# ")) {
    return `\n${pc.bold(pc.underline(pc.magenta(renderInlineMarkdown(trimmed.slice(2)))))}`;
  }

  const bulletMatch = BULLET_REGEX.exec(line);
  if (bulletMatch) {
    const indent = bulletMatch[1];
    const content = bulletMatch[2];
    return `${indent}${pc.magenta("•")} ${renderInlineMarkdown(content)}`;
  }

  const numMatch = NUM_LIST_REGEX.exec(line);
  if (numMatch) {
    const indent = numMatch[1];
    const num = numMatch[2];
    const content = numMatch[3];
    return `${indent}${pc.cyan(num)} ${renderInlineMarkdown(content)}`;
  }

  if (trimmed.startsWith("> ")) {
    return `${pc.gray("│")} ${pc.italic(renderInlineMarkdown(trimmed.slice(2)))}`;
  }

  return renderInlineMarkdown(line);
}

export function resetMarkdownState(): void {
  inCodeBlock = false;
}
