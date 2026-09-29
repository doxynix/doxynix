import { describe, expect, it } from "vitest";

import { countSourceStats } from "./code-counter";

describe("countSourceStats", () => {
  it("counts empty string as zeros", () => {
    expect(countSourceStats("", "ts")).toEqual({
      comments: 0,
      empty: 0,
      source: 0,
      todos: 0,
      total: 0,
    });
  });

  it("handles TypeScript single, block, and mixed comments", () => {
    const code = `// Header comment
import { app } from "./app";

/*
 * Multi-line
 * block
 */
const port = 3000; // Inline comment
const host = "localhost";

export default port;
`;

    const stats = countSourceStats(code, "ts");
    expect(stats.total).toBe(12);
    expect(stats.comments).toBe(6); // 1 single + 4 block lines + 1 mixed
    expect(stats.source).toBe(4); // import, port, host, export
  });

  it("handles Python hash and docstring comments", () => {
    const pyCode = `# Config file
import os

"""
Module docstring
"""
DEBUG = True # Set debug flag
`;

    const stats = countSourceStats(pyCode, "py");
    expect(stats.comments).toBe(5); // 1 single + 3 docstring lines + 1 mixed
    expect(stats.source).toBe(2);
  });

  it("counts no markers in code that carries no comments", () => {
    const code = `const todoList = [];
function fixme() { return 1; }
// no marker on this line
const url = "https://example.com/todo-list";
export { todoList, fixme, url };
`;
    expect(countSourceStats(code, "ts").todos).toBe(0);
  });
});

describe("countSourceStats todo markers", () => {
  it("counts a marker on a full-line comment", () => {
    expect(countSourceStats("// TODO: refactor\n", "ts").todos).toBe(1);
  });

  it("counts a marker on a trailing comment, the case leasot always missed", () => {
    // Every leasot parser anchors the comment marker at the start of the line
    // (`^\s*//`), so all four of these were invisible to the old counter.
    const code = `const a = 1; // TODO: trailing
let b = 2; // FIXME(alice): trailing fixme
const c = 3; /* TODO: trailing block */
const d = 4; /* inline */ // TODO: after a closed block
`;
    expect(countSourceStats(code, "ts").todos).toBe(4);
  });

  it("counts markers on inner lines of a multi-line block comment", () => {
    const code = `/*
 * TODO: first
 * FIXME: second
 * nothing here
 */
const x = 1;
`;
    expect(countSourceStats(code, "ts").todos).toBe(2);
  });

  it("ignores code that appears after a block comment closes on the same line", () => {
    const code = `/* TODO: real */ const TODO_LIST = [];
`;
    expect(countSourceStats(code, "ts").todos).toBe(1);
  });

  it("accepts the @ prefix and is case-insensitive", () => {
    const code = `// @todo lower
// Todo: title case
// FIXMe: mixed
// @FIXME(jo): with reference
`;
    expect(countSourceStats(code, "ts").todos).toBe(4);
  });

  it("rejects identifiers and URLs that merely contain a marker", () => {
    const code = `// todo_list is an identifier
// fixme-it is not a marker
// see https://example.com/todo-list for the list
// TODOS and FIXMES are plurals
const TODO_LIST = [];
const fixmeThing = 1;
`;
    expect(countSourceStats(code, "ts").todos).toBe(0);
  });

  it("counts several markers on one comment line", () => {
    expect(countSourceStats("// TODO: a FIXME: b @todo c\n", "ts").todos).toBe(3);
  });

  it("counts hash comments for Python", () => {
    const code = `# TODO: config
DEBUG = True # FIXME: slow path
value = "not # a comment marker"
`;
    expect(countSourceStats(code, "py").todos).toBe(2);
  });

  it("counts HTML comments", () => {
    const code = `<!-- TODO: markup -->
<div></div><!-- FIXME: trailing -->
`;
    expect(countSourceStats(code, "html").todos).toBe(2);
  });

  it("counts SQL line comments", () => {
    expect(countSourceStats("SELECT 1; -- TODO: slow\n", "sql").todos).toBe(1);
  });

  it("counts YAML hash comments regardless of indentation", () => {
    // leasot routed .yml through coffeeParser, whose regex is `^\s*#`, so the
    // indented and trailing forms were both missed.
    const code = `# TODO: top level
jobs:
  build: make  # FIXME: flaky
`;
    expect(countSourceStats(code, "yml").todos).toBe(2);
  });

  it("counts R comments for both .r and .R, which leasot's case-sensitive table split", () => {
    // leasot's db had ".R" but no ".r", so script.r scored zero. The extension
    // lookup is case-insensitive, so both spellings hit the same HASH_COMMENT.
    const code = `# TODO: fix\nx <- 1\n`;
    expect(countSourceStats(code, "r").todos).toBe(1);
    expect(countSourceStats(code, "R").todos).toBe(1);
    expect(countSourceStats(code, ".r").todos).toBe(1);
  });

  it("counts markers in a language leasot did not support at all", () => {
    // .json and .zig are absent from leasot's table, so they were skipped.
    expect(countSourceStats("// TODO: unsupported before\n", "json").todos).toBe(1);
    expect(countSourceStats("// TODO: unsupported before\n", "zig").todos).toBe(1);
  });

  it("keeps the comment and source line counts unchanged while counting markers", () => {
    const code = `// TODO: header
import { app } from "./app";

/*
 * FIXME: multi-line
 */
const port = 3000; // TODO: inline
`;
    const stats = countSourceStats(code, "ts");
    expect(stats.total).toBe(8);
    expect(stats.source).toBe(2);
    expect(stats.todos).toBe(3);
  });
});
