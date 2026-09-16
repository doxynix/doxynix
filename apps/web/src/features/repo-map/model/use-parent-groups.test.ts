import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { RepoMapNodeData } from "./repo-map.types";
import { enrichNodesWithParents, extractParentGroups } from "./use-parent-groups";

function node(id: string, score = 0, extra?: Record<string, unknown>): Node<RepoMapNodeData> {
  return { data: { id, score, ...extra } as RepoMapNodeData, id, position: { x: 0, y: 0 } };
}

describe("extractParentGroups", () => {
  it("groups children by parent path from group ids", () => {
    const nodes = [
      node("group:src/utils:index.ts"),
      node("group:src/utils:parse.ts"),
      node("group:src/components:button.tsx"),
      node("standalone.ts"),
    ];

    expect(extractParentGroups(nodes)).toEqual([
      {
        children: [
          "group:src/utils:index.ts",
          "group:src/utils:parse.ts",
          "group:src/components:button.tsx",
        ],
        id: "parent-src",
        label: "Src",
      },
    ]);
  });

  it("builds nested parent ids and keeps the path in the label", () => {
    const nodes = [node("group:a/b/c:file.ts")];

    expect(extractParentGroups(nodes)).toEqual([
      { children: ["group:a/b/c:file.ts"], id: "parent-a/b", label: "A/b" },
    ]);
  });

  it("collapses a single-segment group path to an empty parent", () => {
    const nodes = [node("group:src")];

    expect(extractParentGroups(nodes)).toEqual([
      { children: ["group:src"], id: "parent-", label: "" },
    ]);
  });

  it("ignores nodes without the group prefix", () => {
    const nodes = [node("not-a-group"), node("group:only")];

    expect(extractParentGroups(nodes)).toEqual([
      { children: ["group:only"], id: "parent-", label: "" },
    ]);
  });

  it("returns an empty array for no group nodes", () => {
    expect(extractParentGroups([node("a.ts")])).toEqual([]);
  });
});

describe("enrichNodesWithParents", () => {
  const parents = [{ children: ["a", "b"], id: "parent-x", label: "X" }];

  it("creates invisible parent nodes with aggregated item count", () => {
    const result = enrichNodesWithParents([node("a"), node("b")], parents);

    const parentNode = result.find((n) => n.id === "parent-x");
    expect(parentNode).toBeDefined();
    expect(parentNode?.style).toEqual({ opacity: 0 });
    expect(parentNode?.data).toMatchObject({
      id: "parent-x",
      itemCount: 2,
      label: "X",
      score: 0,
    });
    expect(parentNode?.position).toEqual({ x: 0, y: 0 });
    expect(parentNode?.type).toBe("repoNode");
  });

  it("links every child back to its new parent", () => {
    const result = enrichNodesWithParents([node("a"), node("b"), node("c")], parents);

    expect(result.find((n) => n.id === "a")?.parentId).toBe("parent-x");
    expect(result.find((n) => n.id === "b")?.parentId).toBe("parent-x");
    expect(result.find((n) => n.id === "c")?.parentId).toBeUndefined();
  });

  it("carries non-reserved fields from the first child data", () => {
    const result = enrichNodesWithParents(
      [node("a", 7, { depth: 2 }), node("b", 3, { depth: 3 })],
      parents,
    );

    const parentNode = result.find((n) => n.id === "parent-x")!;
    expect((parentNode.data as { depth?: number }).depth).toBe(2);
  });

  it("forces the parent score to zero regardless of children", () => {
    const result = enrichNodesWithParents([node("a", 7), node("b", 3)], parents);

    const parentNode = result.find((n) => n.id === "parent-x")!;
    expect(parentNode.data.score).toBe(0);
  });

  it("keeps nodes without matching parents untouched", () => {
    const result = enrichNodesWithParents([node("c")], parents);

    expect(result.find((n) => n.id === "c")).toMatchObject({
      data: { id: "c", score: 0 },
      id: "c",
      position: { x: 0, y: 0 },
    });
  });
});
