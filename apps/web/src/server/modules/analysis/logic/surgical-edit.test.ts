import { describe, expect, it } from "vitest";

import {
  adjustIndentation,
  applySurgicalEditBlock,
  getIndent,
  getTokens,
  lineSimilarity,
} from "./surgical-edit";

describe("getIndent", () => {
  it("returns leading whitespace of a line", () => {
    expect(getIndent("")).toBe("");
    expect(getIndent("foo")).toBe("");
    expect(getIndent("  foo")).toBe("  ");
    expect(getIndent("\t\tfoo")).toBe("\t\t");
    expect(getIndent("   ")).toBe("   ");
  });
});

describe("adjustIndentation", () => {
  it("returns lines untouched when indentation already matches", () => {
    const lines = ["const x = 1;", "  return x;", ""];
    expect(adjustIndentation(lines, "  ", "  ")).toEqual(lines);
  });

  it("deepens indentation from search indent to target indent", () => {
    expect(adjustIndentation(["const x = 1;", "if (x) {", "  return x;", "}"], "", "  ")).toEqual([
      "  const x = 1;",
      "  if (x) {",
      "    return x;",
      "  }",
    ]);
  });

  it("shallowens indentation when target is less deep", () => {
    expect(adjustIndentation(["  const x = 1;", "    const y = 2;"], "  ", "")).toEqual([
      "const x = 1;",
      "  const y = 2;",
    ]);
  });

  it("keeps blank lines empty", () => {
    expect(adjustIndentation(["", "const x = 1;"], "  ", "\t")).toEqual(["", "\tconst x = 1;"]);
  });

  it("applies target indent to lines that do not start with the search indent", () => {
    expect(adjustIndentation(["z", "  y"], "  ", "\t")).toEqual(["\tz", "\ty"]);
  });
});

describe("getTokens", () => {
  it("lowercases and splits on punctuation and whitespace", () => {
    expect(getTokens("const FooBar = 42;")).toEqual(["const", "foobar", "42"]);
    expect(getTokens("a.b()")).toEqual(["a", "b"]);
    expect(getTokens("return a + b;")).toEqual(["return", "a", "b"]);
  });

  it("drops empty tokens", () => {
    expect(getTokens("")).toEqual([]);
    expect(getTokens("   ")).toEqual([]);
    expect(getTokens("!")).toEqual([]);
  });
});

describe("lineSimilarity", () => {
  it("is 1 for identical lines", () => {
    expect(lineSimilarity("const x = 1;", "const x = 1;")).toBe(1);
  });

  it("is 1 when token sets match despite reordering", () => {
    expect(lineSimilarity("return a + b;", "return b + a;")).toBe(1);
  });

  it("is 0 for disjoint token sets", () => {
    expect(lineSimilarity("const x = 1;", "return y;")).toBe(0);
  });

  it("is 1 when both lines are empty", () => {
    expect(lineSimilarity("", "")).toBe(1);
  });

  it("is 0 when exactly one line is empty", () => {
    expect(lineSimilarity("const x = 1;", "")).toBe(0);
  });

  it("returns the Jaccard index of the token sets", () => {
    // {const,total,price,fees} vs {const,total,price,tax} → 3 common of 5
    expect(lineSimilarity("const total = price + fees;", "const total = price + tax;")).toBeCloseTo(
      0.6,
    );
  });
});

describe("applySurgicalEditBlock", () => {
  it("replaces an exact match with kind exact and similarity 1", () => {
    const result = applySurgicalEditBlock({
      fileContent: "function add(a, b) {\n  return a + b;\n}",
      replaceBlock: "  return a - b;",
      searchBlock: "  return a + b;",
    });

    expect(result.kind).toBe("exact");
    expect(result.similarity).toBe(1);
    expect(result.content).toBe("function add(a, b) {\n  return a - b;\n}");
  });

  it("adapts replacement indentation to the target file (kind indent)", () => {
    const result = applySurgicalEditBlock({
      fileContent: "    const x = 1;\n    const y = 2;",
      replaceBlock: "const x = 10;\nconst y = 20;",
      searchBlock: "const x = 1;\nconst y = 2;",
    });

    expect(result.kind).toBe("indent");
    expect(result.similarity).toBe(1);
    expect(result.content).toBe("    const x = 10;\n    const y = 20;");
  });

  it("matches blocks whose blank lines line up as whitespace-only lines", () => {
    const result = applySurgicalEditBlock({
      fileContent: "function a() {\n  \n  return 1;\n}",
      replaceBlock: "function a() {\n\n  return 2;\n}",
      searchBlock: "function a() {\n\n  return 1;\n}",
    });

    expect(result.kind).toBe("indent");
    expect(result.similarity).toBe(1);
    expect(result.content).toBe("function a() {\n\n  return 2;\n}");
  });

  it("applies a fuzzy match when lines are similar enough (kind fuzzy)", () => {
    const result = applySurgicalEditBlock({
      fileContent: "const base = 100;\nconst total = price + tax;",
      replaceBlock: "const base = 200;\nconst total = price + fees;",
      searchBlock: "const base = 100;\nconst total = price + fees;",
    });

    expect(result.kind).toBe("fuzzy");
    // (1.0 + 0.6) / 2 = 0.8, above the 0.75 threshold
    expect(result.similarity).toBe(0.8);
    expect(result.content).toBe("const base = 200;\nconst total = price + fees;");
  });

  it("matches fuzzy when text differs but token sets are identical", () => {
    const result = applySurgicalEditBlock({
      fileContent: "const x = a + b;",
      replaceBlock: "const x = a + b;",
      searchBlock: "const x = b + a;",
    });

    expect(result.kind).toBe("fuzzy");
    expect(result.similarity).toBe(1);
    expect(result.content).toBe("const x = a + b;");
  });

  it("returns kind none when similarity stays below the threshold", () => {
    const result = applySurgicalEditBlock({
      fileContent: "const a = 1;\nconst b = 2;",
      replaceBlock: "const x = 10;\nconst y = 20;",
      searchBlock: "const x = 1;\nconst y = 2;",
    });

    expect(result.kind).toBe("none");
    expect(result.similarity).toBe(0);
    expect(result.content).toBe("const a = 1;\nconst b = 2;");
  });

  it("returns kind none when the search block is longer than the file", () => {
    const result = applySurgicalEditBlock({
      fileContent: "const a = 1;",
      replaceBlock: "const a = 10;\nconst b = 20;\nconst c = 30;",
      searchBlock: "const a = 1;\nconst b = 2;\nconst c = 3;",
    });

    expect(result.kind).toBe("none");
    expect(result.similarity).toBe(0);
    expect(result.content).toBe("const a = 1;");
  });
});
