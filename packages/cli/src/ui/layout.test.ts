import { describe, expect, it } from "vitest";

import { getStringWidth, stripAnsi } from "./formatters";
import { renderBlock, renderCard, renderKeyValue, renderSection } from "./layout";
import { createTable } from "./table";

// Column position must be measured in terminal columns, not code units: a CJK
// label is shorter in `.length` than it renders, so counting code units hides
// misalignment.
function valueStartColumn(line: string): number {
  const value = line.slice(line.lastIndexOf(":") + 1).trimStart();
  return getStringWidth(line.slice(0, line.length - value.length));
}

describe("renderKeyValue", () => {
  it("returns an empty string for no items", () => {
    expect(renderKeyValue([])).toBe("");
  });

  it("drops items whose value is null, undefined or an empty string", () => {
    const output = stripAnsi(
      renderKeyValue([
        ["kept", "yes"],
        ["nullish", null],
        ["missing", undefined],
        ["blank", ""],
      ]),
    );

    expect(output).toContain("kept");
    expect(output).not.toContain("nullish");
    expect(output).not.toContain("missing");
    expect(output).not.toContain("blank");
  });

  it("keeps a zero value, which is falsy but meaningful", () => {
    expect(stripAnsi(renderKeyValue([["count", 0]]))).toContain("0");
  });

  it("starts every value at the same column regardless of label length", () => {
    const output = stripAnsi(
      renderKeyValue([
        ["Name", "alice"],
        ["Repository Identifier", "r1"],
        ["Email", "a@b.c"],
      ]),
    );

    const starts = output.split("\n").map((line) => valueStartColumn(line));

    expect(new Set(starts).size).toBe(1);
  });

  it("aligns values by display width, not by code-unit length", () => {
    // The widest label must itself be wide-rendered: "标识符" is 3 code units but
    // 6 columns. Padding is measured against that rendered width, so every value
    // starts exactly indent + widestColumn + 1 (colon) + 2 (gutter).
    const labels = ["Name", "标识", "标识符"];
    const output = stripAnsi(
      renderKeyValue([
        ["Name", "a"],
        ["标识", "b"],
        ["标识符", "c"],
      ]),
    );

    const widestColumn = Math.max(...labels.map((label) => getStringWidth(label)));
    const expectedStart = 2 + widestColumn + 1 + 2;

    expect(labels.map((l) => getStringWidth(l))).not.toEqual(labels.map((l) => l.length));
    for (const line of output.split("\n")) {
      expect(valueStartColumn(line)).toBe(expectedStart);
    }
  });

  it("honours a custom indent", () => {
    expect(renderKeyValue([["k", "v"]], 4).startsWith("    ")).toBe(true);
    expect(renderKeyValue([["k", "v"]], 0).startsWith("k:")).toBe(true);
  });
});

describe("renderCard", () => {
  it("wraps a title and its key-value body", () => {
    const output = stripAnsi(renderCard("Current Profile", [["Name", "Karen"]]));

    expect(output).toContain("Current Profile");
    expect(output).toContain("Name");
    expect(output).toContain("Karen");
  });
});

describe("renderSection", () => {
  it("places the body under the title", () => {
    expect(stripAnsi(renderSection("Title", "body"))).toBe("\nTitle\n\nbody\n");
  });

  it("accepts a table object via its toString contract", () => {
    const table = createTable(["A"]);
    table.push(["x"]);

    const output = stripAnsi(renderSection("Title", table));

    expect(output).toContain("Title");
    expect(output).toContain("│ A │");
  });
});

describe("renderBlock", () => {
  it("brackets the content with start and end markers", () => {
    const output = stripAnsi(renderBlock("Report", "body"));

    expect(output).toContain("=== Report ===");
    expect(output).toContain("body");
    expect(output).toContain("=== End ===");
  });
});

describe("createTable", () => {
  it("returns an empty string when there are no columns", () => {
    expect(createTable([]).toString()).toBe("");
  });

  it("renders headers and rows with a border box", () => {
    const table = createTable(["Name", "Value"]);
    table.push(["alpha", "1"]);

    const output = stripAnsi(table.toString());

    expect(output).toContain("┌");
    expect(output).toContain("Name");
    expect(output).toContain("alpha");
    expect(output).toContain("└");
  });

  it("pads every rendered line to the same visible width", () => {
    const table = createTable(["Key", "Value"]);
    table.push(["short", "x"]);
    table.push(["a much longer key here", "y"]);

    const widths = stripAnsi(table.toString())
      .split("\n")
      .filter((line) => line.includes("│"))
      .map((line) => getStringWidth(line));

    expect(new Set(widths).size).toBe(1);
  });

  it("spans a multi-line cell across rows without breaking the border", () => {
    const table = createTable(["A", "B"]);
    table.push(["k", "line1\nline2"]);

    const output = stripAnsi(table.toString());

    expect(output).toContain("line1");
    expect(output).toContain("line2");
    const cellLines = output.split("\n").filter((line) => line.includes("│"));
    expect(new Set(cellLines.map((line) => getStringWidth(line))).size).toBe(1);
  });

  it("accepts several rows pushed at once", () => {
    const table = createTable(["A"]);
    table.push(["one"], ["two"], ["three"]);

    const output = stripAnsi(table.toString());

    expect(output).toContain("one");
    expect(output).toContain("two");
    expect(output).toContain("three");
  });
});
