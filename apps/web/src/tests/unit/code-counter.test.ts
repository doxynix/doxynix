import { describe, expect, it } from "vitest";

import { countSourceStats } from "@/server/utils/code-counter";

describe("countSourceStats", () => {
  it("counts empty string as zeros", () => {
    expect(countSourceStats("", "ts")).toEqual({
      comments: 0,
      empty: 0,
      source: 0,
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
});
