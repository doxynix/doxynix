import { describe, expect, it } from "vitest";

import { pc } from "./colors";
import { getStringWidth, stripAnsi } from "./formatters";
import { createTable } from "./table";

describe("createTable", () => {
  it("caps a wide cell at maxWidth instead of stretching the table", () => {
    const table = createTable(["Name"], { maxWidth: 20 });
    table.push(["x".repeat(120)]);

    const first = table.toString();
    const second = table.toString();

    expect(second).toBe(first);

    for (const line of first.split("\n")) {
      expect(getStringWidth(line)).toBeLessThanOrEqual(20);
    }
    expect(first).toContain("…");
  });

  it("defaults to a 120 column ceiling", () => {
    const table = createTable(["Name"]);
    table.push(["y".repeat(400)]);

    const first = table.toString();

    expect(table.toString()).toBe(first);

    for (const line of first.split("\n")) {
      expect(getStringWidth(line)).toBeLessThanOrEqual(120);
    }
  });

  it("leaves a narrow table untouched", () => {
    const table = createTable(["A", "B"]);
    table.push(["1", "2"]);

    // Vitest forces ANSI colours on, so strip them before matching the raw glyphs.
    expect(stripAnsi(table.toString())).toContain("│ 1 │ 2 │");
  });

  it.each([
    { cells: 15, cols: 1, maxWidth: 10 },
    { cells: 15, cols: 2, maxWidth: 20 },
    { cells: 15, cols: 3, maxWidth: 13 },
    { cells: 15, cols: 3, maxWidth: 12 },
    { cells: 15, cols: 4, maxWidth: 30 },
    { cells: 15, cols: 5, maxWidth: 8 },
    { cells: 15, cols: 8, maxWidth: 100 },
    { cells: 15, cols: 8, maxWidth: 60 },
    { cells: 15, cols: 8, maxWidth: 120 },
    { cells: 4, cols: 4, maxWidth: 2 },
  ])("fits $cols columns of $cells-char cells within $maxWidth", ({ cells, cols, maxWidth }) => {
    const head = Array.from({ length: cols }, (_, i) => `Col${i}`);
    const table = createTable(head, { maxWidth });
    table.push(
      Array.from({ length: cols }, () => "x".repeat(cells)),
      Array.from({ length: cols }, (_, i) => (i === 0 ? "a\nb\nc" : "y".repeat(cells))),
    );

    const first = table.toString();

    expect(table.toString()).toBe(first);

    for (const line of first.split("\n")) {
      expect(getStringWidth(line)).toBeLessThanOrEqual(maxWidth);
    }
  });

  it("closes header styling per line so multi-line headers do not bleed", () => {
    const table = createTable(["A", "head1\nhead2"]);
    table.push(["1", "2"]);

    const firstHeaderLine = table.toString().split("\n")[1] ?? "";

    expect(firstHeaderLine).toContain(pc.cyan(pc.bold("head1")));
  });

  it("keeps every line of a multi-line header once the shrink binds", () => {
    const table = createTable(["Report\nGeneration\nDate"], { maxWidth: 20 });
    table.push(["2026-10-17"]);

    const rendered = stripAnsi(table.toString());

    expect(rendered).toContain("Report");
    expect(rendered).toContain("Date");
  });
});
