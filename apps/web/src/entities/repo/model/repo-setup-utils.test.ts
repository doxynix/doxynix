import { describe, expect, it } from "vitest";

import type { FileNode, FileTuple } from "./repo-setup.types";
import {
  buildFileTree,
  collectAllIds,
  countSelectedFiles,
  getFolderSelectionState,
  getRecommendedPaths,
  matchesSearch,
  sortNodes,
} from "./repo-setup-utils";

function file(id: string, children?: FileNode[]): FileNode {
  return { children, id, name: id, path: id, sha: id, type: children ? "tree" : "blob" };
}

describe("sortNodes", () => {
  it("puts nodes without children arrays first, then sorts by name", () => {
    const nodes = sortNodes([file("file10.ts"), file("folder", [file("b.ts")]), file("file2.ts")]);

    expect(nodes.map((n) => n.name)).toEqual(["file2.ts", "file10.ts", "folder"]);
  });

  it("sorts recursively into children", () => {
    const nodes = sortNodes([file("root", [file("b.ts"), file("a.ts")])]);

    expect(nodes[0]?.children?.map((n) => n.name)).toEqual(["a.ts", "b.ts"]);
  });
});

describe("collectAllIds", () => {
  it("collects ids depth-first in pre-order", () => {
    const tree = file("root", [file("a", [file("a1")]), file("b")]);

    expect(collectAllIds(tree)).toEqual(["root", "a", "a1", "b"]);
  });

  it("collects a single id for a leaf", () => {
    expect(collectAllIds(file("leaf"))).toEqual(["leaf"]);
  });
});

describe("getFolderSelectionState", () => {
  it("treats a leaf as selected when its id is present", () => {
    expect(getFolderSelectionState(file("a.ts"), new Set(["a.ts"]))).toBe(true);
    expect(getFolderSelectionState(file("a.ts"), new Set(["b.ts"]))).toBe(false);
  });

  it("treats an empty folder as a leaf", () => {
    expect(getFolderSelectionState(file("empty", []), new Set(["empty"]))).toBe(true);
    expect(getFolderSelectionState(file("empty", []), new Set())).toBe(false);
  });

  it("is false when nothing is selected", () => {
    const tree = file("root", [file("a"), file("b")]);

    expect(getFolderSelectionState(tree, new Set())).toBe(false);
  });

  it("is true when every descendant is selected", () => {
    const tree = file("root", [file("a"), file("b")]);

    expect(getFolderSelectionState(tree, new Set(["a", "b"]))).toBe(true);
  });

  it("is indeterminate on partial selection", () => {
    const tree = file("root", [file("a"), file("b")]);

    expect(getFolderSelectionState(tree, new Set(["a"]))).toBe("indeterminate");
  });

  it("counts nested descendants including folder nodes themselves", () => {
    const tree = file("root", [file("dir", [file("deep1"), file("deep2")]), file("b")]);

    expect(getFolderSelectionState(tree, new Set(["deep1"]))).toBe("indeterminate");
    expect(getFolderSelectionState(tree, new Set(["deep1", "b"]))).toBe("indeterminate");
    // dir is counted but not selectable, so full selection never resolves to true
    expect(getFolderSelectionState(tree, new Set(["deep1", "deep2", "b"]))).toBe("indeterminate");
  });
});

const files: FileTuple[] = [
  ["src/index.ts", 1, "sha-index", 1],
  ["src/utils/parse.ts", 1, "sha-parse", 1],
  ["src/utils/format.ts", 1, "sha-format", 0],
  ["src/README.md", 1, "sha-readme", 0],
  ["docs/guide.md", 1, "sha-guide", 0],
  ["src/layouts", 2, "sha-layouts", 1],
];

describe("getRecommendedPaths", () => {
  it("returns blob paths marked as recommended", () => {
    expect(getRecommendedPaths(files)).toEqual(["src/index.ts", "src/utils/parse.ts"]);
  });

  it("excludes recommended tree entries", () => {
    expect(getRecommendedPaths(files)).not.toContain("src/layouts");
  });

  it("returns an empty array for undefined files", () => {
    expect(getRecommendedPaths(undefined)).toEqual([]);
  });
});

describe("buildFileTree", () => {
  const tree = buildFileTree(files);

  it("builds sorted root folders first", () => {
    expect(tree.map((n) => n.name)).toEqual(["docs", "src"]);
  });

  it("marks leaf nodes as blobs with sha and recommended flags", () => {
    const index = tree.find((n) => n.id === "src")?.children?.find((n) => n.id === "src/index.ts");

    expect(index).toMatchObject({
      children: undefined,
      name: "index.ts",
      recommended: true,
      sha: "sha-index",
      type: "blob",
    });
  });

  it("builds internal nodes as trees with empty required fields", () => {
    const utils = tree.find((n) => n.id === "src")?.children?.find((n) => n.id === "src/utils");

    expect(utils).toMatchObject({
      children: expect.any(Array),
      name: "utils",
      recommended: false,
      sha: "",
      type: "tree",
    });
    expect(utils?.children?.map((n) => n.name)).toEqual(["format.ts", "parse.ts"]);
  });

  it("dedupes repeated paths", () => {
    const tree = buildFileTree([...files, ["src/index.ts", 1, "sha-index", 1]]);
    const src = tree.find((n) => n.id === "src")!;

    expect(src.children).toHaveLength(4);
    expect(src.children?.filter((n) => n.id === "src/index.ts")).toHaveLength(1);
  });

  it("returns an empty tree for undefined files", () => {
    expect(buildFileTree(undefined)).toEqual([]);
  });
});

describe("countSelectedFiles", () => {
  it("counts only selected leaf file paths", () => {
    expect(countSelectedFiles(new Set(["src/index.ts", "src/utils/parse.ts", "src"]), files)).toBe(
      2,
    );
  });

  it("ignores unknown ids", () => {
    expect(countSelectedFiles(new Set(["nope.ts"]), files)).toBe(0);
  });

  it("returns zero for undefined files", () => {
    expect(countSelectedFiles(new Set(["src/index.ts"]), undefined)).toBe(0);
  });
});

describe("matchesSearch", () => {
  it("matches every file for an empty term", () => {
    expect(matchesSearch("", files)).toBe(true);
  });

  it("matches paths case-insensitively", () => {
    expect(matchesSearch("PARSE", files)).toBe(true);
    expect(matchesSearch("utils", files)).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesSearch("zzz", files)).toBe(false);
  });

  it("is undefined for missing files with a term", () => {
    expect(matchesSearch("parse", undefined)).toBeUndefined();
  });
});
