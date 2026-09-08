import { brand, pc } from "./colors";
import { stripAnsi } from "./formatters";

export type NoticeLevel = "info" | "success" | "warning" | "error";

export function renderNoticeBox(
  title: string,
  lines: string[],
  level: NoticeLevel = "info",
): string {
  const colorFn =
    level === "error"
      ? brand.error
      : level === "warning"
        ? brand.warning
        : level === "success"
          ? brand.success
          : brand.info;

  const content = [colorFn(pc.bold(` ${title} `)), ...lines.map((l) => `  ${l}`)];
  const maxLen = Math.max(...content.map((c) => stripAnsi(c).length), 45);

  const top = pc.gray(`┌${"─".repeat(maxLen + 2)}┐`);
  const bottom = pc.gray(`└${"─".repeat(maxLen + 2)}┘`);
  const body = content
    .map((line) => {
      const visibleLen = stripAnsi(line).length;
      const pad = " ".repeat(Math.max(0, maxLen - visibleLen));
      return `${pc.gray("│")} ${line}${pad} ${pc.gray("│")}`;
    })
    .join("\n");

  return `\n${top}\n${body}\n${bottom}\n`;
}
