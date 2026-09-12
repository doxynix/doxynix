import { pc } from "./colors";

let inCodeBlock = false;

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
    const lang = trimmed.slice(3).trim();
    return inCodeBlock ? pc.gray(`\n┌── ${lang ? pc.cyan(lang) : "Code"} ───`) : pc.gray("└───\n");
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

  const bulletMatch = new RegExp(/^(\s*)[*+-]\s+(.*)$/).exec(line);
  if (bulletMatch) {
    const indent = bulletMatch[1];
    const content = bulletMatch[2];
    return `${indent}${pc.magenta("•")} ${renderInlineMarkdown(content)}`;
  }

  const numMatch = new RegExp(/^(\s*)(\d+\.)\s+(.*)$/).exec(line);
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
