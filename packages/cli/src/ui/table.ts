import { pc } from "./colors";
import { getStringWidth } from "./formatters";

export type TableCell = unknown;
export type TableRow = TableCell[];

export interface Table {
  push(...rows: TableRow[]): void;
  toString(): string;
}

export function createTable(head: string[]): Table {
  const rows: TableRow[] = [];

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

      const colWidths = head.map((h) => getStringWidth(h));

      for (const row of rows) {
        for (let i = 0; i < colCount; i++) {
          const val = row[i] ?? "";
          const lines = String(val).split(/\r?\n/);
          for (const line of lines) {
            colWidths[i] = Math.max(colWidths[i] ?? 0, getStringWidth(line));
          }
        }
      }

      const hLine = (left: string, mid: string, right: string) => {
        const line = colWidths.map((w) => "─".repeat(w + 2)).join(mid);
        return pc.gray(`${left}${line}${right}`);
      };

      const renderRow = (cells: TableRow, isHeader = false) => {
        const cellLines = cells.map((cell) => {
          const rawLines = String(cell).split(/\r?\n/);
          return isHeader ? rawLines.map((l) => pc.cyan(pc.bold(l))) : rawLines;
        });

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

      const output: string[] = [];
      output.push(hLine("┌", "┬", "┐"));
      output.push(renderRow(head, true));
      output.push(hLine("├", "┼", "┤"));

      for (const row of rows) {
        output.push(renderRow(row, false));
      }

      output.push(hLine("└", "┴", "┘"));
      return output.join("\n");
    },
  };
}
