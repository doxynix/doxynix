import { describe, expect, it } from "vitest";

import { applyDocumentSurgicalEdit } from "./document-surgical-edit";

const FILE = ["export function run() {", "  const x = 1;", "  return x;", "}"].join("\n");

describe("applyDocumentSurgicalEdit", () => {
  it("replaces an exactly matching block", () => {
    expect(
      applyDocumentSurgicalEdit({
        filePath: "src/a.ts",
        original: FILE,
        replace: "  const x = 2;",
        search: "  const x = 1;",
      }),
    ).toBe(["export function run() {", "  const x = 2;", "  return x;", "}"].join("\n"));
  });

  it("normalises CRLF before matching", () => {
    const crlf = "a\r\nconst x = 1;\r\nb";
    const result = applyDocumentSurgicalEdit({
      filePath: "src/a.ts",
      original: crlf,
      replace: "const x = 2;",
      search: "const x = 1;",
    });

    expect(result).toContain("const x = 2;");
    expect(result).not.toContain("\r");
  });

  it("matches a block whose indentation drifted and re-indents the replacement", () => {
    const result = applyDocumentSurgicalEdit({
      filePath: "src/a.ts",
      original: FILE,
      replace: "      const x = 2;\n      log(x);",
      search: "  const x = 1;\n  return x;",
    });

    expect(result).toContain("      const x = 2;");
    expect(result).toContain("      log(x);");
  });

  it("returns the original content unchanged when the block cannot be found", () => {
    expect(
      applyDocumentSurgicalEdit({
        filePath: "src/a.ts",
        original: FILE,
        replace: "whatever",
        search: "this text does not exist anywhere",
      }),
    ).toBe(FILE);
  });

  it("leaves an empty original untouched", () => {
    expect(
      applyDocumentSurgicalEdit({
        filePath: "src/empty.ts",
        original: "",
        replace: "x",
        search: "y",
      }),
    ).toBe("");
  });
});
