import { describe, expect, it } from "vitest";

import {
  renderBranchesTable,
  renderFileTree,
  renderGithubReposTable,
  sanitizePath,
} from "./github.formatter";

describe("github formatter", () => {
  it("removes control characters from file paths", () => {
    expect(sanitizePath("src\x00/index.ts")).toBe("src/index.ts");
  });

  it("renders a repo table with visibility and default branch", () => {
    const output = renderGithubReposTable([
      {
        default_branch: "main",
        description: "Core application repo",
        fullName: "acme/platform",
        private: false,
      },
    ] as any);

    expect(output).toContain("Repository");
    expect(output).toContain("acme/platform");
    expect(output).toContain("main");
    expect(output).toContain("Core application repo");
  });

  it("renders branch rows and file tree rows", () => {
    expect(renderBranchesTable(["main", "feature/test"] as any)).toContain("main");

    const tree = renderFileTree([
      ["src/index.ts", 1, "abc123"],
      ["src", 0, "folder"],
    ]);

    expect(tree).toContain("src/index.ts");
    expect(tree).toContain("Directory");
    expect(tree).toContain("File");
  });
});
