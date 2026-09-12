import { brand } from "./colors";
import { getStringWidth } from "./formatters";

export type KeyValueItem = [label: string, value: string | number | null | undefined];

export function renderKeyValue(items: KeyValueItem[], indent = 2): string {
  const validItems = items.filter(([, val]) => val !== null && val !== undefined && val !== "");
  if (validItems.length === 0) {
    return "";
  }

  const maxLabelWidth = Math.max(...validItems.map(([label]) => getStringWidth(label)));
  const prefix = " ".repeat(indent);

  const lines = validItems.map(([label, value]) => {
    const labelWidth = getStringWidth(label);
    const padding = " ".repeat(maxLabelWidth - labelWidth + 2);
    return `${prefix}${brand.muted(label)}:${padding}${value}`;
  });

  return lines.join("\n");
}

export function renderCard(title: string, items: KeyValueItem[]): string {
  return `\n  ${title}\n${renderKeyValue(items)}\n`;
}

export function renderSection(title: string, body: string | { toString(): string }): string {
  const content = typeof body === "string" ? body : body.toString();
  return `\n${title}\n\n${content}\n`;
}

export function renderBlock(title: string, content: string): string {
  return `\n${brand.info(`=== ${title} ===`)}\n\n${content}\n\n${brand.info("=== End ===")}\n`;
}
