import { pc } from "./colors";
import { getStringWidth, truncateToWidth } from "./formatters";

export type TableCell = unknown;
export type TableRow = TableCell[];

export type TableOptions = {
  maxWidth?: number;
};

export type Table = {
  push(...rows: TableRow[]): void;
  toString(): string;
};

const DEFAULT_MAX_WIDTH = 120;

// TableCell is `unknown`, so a bare String() would render "[object Object]".
function cellText(value: unknown): string {
  if (value == null) {
    return "";
  }

  return typeof value === "object" ? (JSON.stringify(value) ?? "") : String(value);
}

// Water-fill: cut every column tied at the widest width until the budget is met.
// Caller guarantees budget >= column count, so the widest column is > 1 while overflowing.
function fitColumnWidths(natural: number[], budget: number): number[] {
  const fitted = [...natural];
  let total = fitted.reduce((sum, w) => sum + w, 0);

  while (total > budget) {
    const widest = Math.max(...fitted);
    const tied = fitted.filter((w) => w === widest).length;
    const cut = Math.min(widest - 1, Math.ceil((total - budget) / tied));
    for (let i = 0; i < fitted.length; i++) {
      const width = fitted[i];
      if (width === widest) {
        fitted[i] = width - cut;
      }
    }
    total = fitted.reduce((sum, w) => sum + w, 0);
  }

  return fitted;
}

export function createTable(head: string[], options: TableOptions = {}): Table {
  const rows: TableRow[] = [];
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;

  return {
    push(...newRows: TableRow[]): void {
      for (const row of newRows) {
        rows.push(row);
      }
    },

    toString(): string {
      const colCount = head.length;
      if (colCount === 0) {
        return "";
      }

      const naturalWidths = head.map((h) => getStringWidth(h));

      for (const row of rows) {
        for (let i = 0; i < colCount; i++) {
          const lines = cellText(row[i]).split(/\r?\n/);
          for (const line of lines) {
            naturalWidths[i] = Math.max(naturalWidths[i] ?? 0, getStringWidth(line));
          }
        }
      }

      // Borders cost three columns per column plus one closing border, so a table
      // narrower than 4n + 1 renders borderless instead of overflowing maxWidth.
      if (maxWidth < colCount * 4 + 1) {
        const gap = maxWidth >= colCount ? " " : "";
        const cellWidth = Math.max(
          0,
          Math.floor((maxWidth - gap.length * (colCount - 1)) / colCount),
        );
        const flat = (value: unknown) =>
          truncateToWidth(cellText(value).replaceAll(/\r?\n/g, " "), cellWidth);

        return [
          head.map((cell) => pc.cyan(pc.bold(flat(cell)))).join(gap),
          ...rows.map((row) => head.map((_, i) => flat(row[i])).join(gap)),
        ].join("\n");
      }

      const colWidths = fitColumnWidths(naturalWidths, maxWidth - (colCount * 3 + 1));

      const headRow = head.map((cell, i) =>
        cellText(cell)
          .split(/\r?\n/)
          .map((line) => truncateToWidth(line, colWidths[i] ?? 0))
          .join("\n"),
      );
      const bodyRows = rows.map((row) =>
        colWidths.map((width, i) =>
          cellText(row[i])
            .split(/\r?\n/)
            .map((line) => truncateToWidth(line, width))
            .join("\n"),
        ),
      );

      const hLine = (left: string, mid: string, right: string) => {
        const line = colWidths.map((w) => "─".repeat(w + 2)).join(mid);
        return pc.gray(`${left}${line}${right}`);
      };

      const renderRow = (cells: string[], isHeader = false) => {
        const cellLines = cells.map((cell) =>
          isHeader
            ? cell.split(/\r?\n/).map((line) => pc.cyan(pc.bold(line)))
            : cell.split(/\r?\n/),
        );

        while (cellLines.length < colCount) {
          cellLines.push([""]);
        }

        const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
        const renderedOutputLines: string[] = [];

        for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
          const formattedCols = colWidths.map((colWidth, colIdx) => {
            const lines = cellLines[colIdx] ?? [""];
            const text = lines[lineIdx] ?? "";
            const visibleWidth = getStringWidth(text);
            const padding = " ".repeat(Math.max(0, colWidth - visibleWidth));
            return ` ${text}${padding} `;
          });

          const separator = pc.gray("│");
          renderedOutputLines.push(`${separator}${formattedCols.join(separator)}${separator}`);
        }

        return renderedOutputLines.join("\n");
      };

      const output: string[] = [
        hLine("┌", "┬", "┐"),
        renderRow(headRow, true),
        hLine("├", "┼", "┤"),
        ...bodyRows.map((row) => renderRow(row, false)),
        hLine("└", "┴", "┘"),
      ];
      return output.join("\n");
    },
  };
}
