import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { RepoMapDisplayData, RepoMapNodeData } from "./repo-map.types";
import { applyEdgeHover, enrichRepoMapNodes } from "./repo-map-hover";

const EDGE = (id: string, source: string, target: string, relation?: string) =>
  ({
    data: relation == null ? undefined : { relation },
    id,
    source,
    target,
  }) as unknown as Edge;

const NODE = (id: string, dimBySearch = false) =>
  ({
    data: { repoMap: dimBySearch ? { dimBySearch: true } : undefined },
    id,
  }) as unknown as Node<RepoMapNodeData>;

const DATA = (filters?: Record<string, string[]>) =>
  (filters == null ? {} : { filters }) as unknown as RepoMapDisplayData;

describe("applyEdgeHover", () => {
  it("keeps edges fully visible and non-animated without a hovered node", () => {
    const edges = [EDGE("e1", "a", "b"), EDGE("e2", "b", "c")];

    const result = applyEdgeHover(edges, null);

    expect(result.map((e) => e.style?.opacity)).toEqual([1, 1]);
    expect(result.map((e) => e.animated)).toEqual([false, false]);
  });

  it("dims edges that do not touch the hovered node", () => {
    const edges = [EDGE("e1", "a", "b"), EDGE("e2", "c", "d")];

    const result = applyEdgeHover(edges, "b");

    expect(result[0]?.style?.opacity).toBe(1);
    expect(result[1]?.style?.opacity).toBe(0.05);
  });

  it("animates edges outgoing from the hovered node", () => {
    const edges = [EDGE("e1", "a", "b"), EDGE("e2", "b", "a")];

    const result = applyEdgeHover(edges, "a");

    expect(result[0]?.animated).toBe(true);
    expect(result[1]?.animated).toBe(false);
    expect(result[1]?.style?.opacity).toBe(1);
  });

  it("keeps cycle edges animated even without hover", () => {
    const edges = [EDGE("e1", "a", "b", "cycle")];

    const result = applyEdgeHover(edges, null);

    expect(result[0]?.animated).toBe(true);
    expect(result[0]?.style?.opacity).toBe(1);
  });
});

describe("enrichRepoMapNodes", () => {
  it("dims nothing with no hover and no active filter", () => {
    const nodes = [NODE("a"), NODE("b")];

    const result = enrichRepoMapNodes(nodes, {
      data: DATA(),
      highlightKey: null,
      hoveredNodeId: null,
      rawEdges: undefined,
    });

    expect(result.map((n) => n.data.repoMap?.dimByHover)).toEqual([false, false]);
    expect(result.map((n) => n.data.repoMap?.dimByFilter)).toEqual([false, false]);
  });

  it("dims only nodes outside the hovered one-hop cluster", () => {
    const nodes = [NODE("a"), NODE("b"), NODE("c")];

    const result = enrichRepoMapNodes(nodes, {
      data: DATA(),
      highlightKey: null,
      hoveredNodeId: "a",
      rawEdges: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    });

    expect(result.map((n) => n.data.repoMap?.dimByHover)).toEqual([false, false, true]);
  });

  it("keeps only the hovered node visible when there are no edges", () => {
    const nodes = [NODE("x"), NODE("y")];

    const result = enrichRepoMapNodes(nodes, {
      data: DATA(),
      highlightKey: null,
      hoveredNodeId: "x",
      rawEdges: [],
    });

    expect(result.map((n) => n.data.repoMap?.dimByHover)).toEqual([false, true]);
  });

  it("dims nodes missing from the active filter list", () => {
    const nodes = [NODE("a"), NODE("b")];

    const result = enrichRepoMapNodes(nodes, {
      data: DATA({ api: ["a"] }),
      highlightKey: "api",
      hoveredNodeId: null,
      rawEdges: undefined,
    });

    expect(result.map((n) => n.data.repoMap?.dimByFilter)).toEqual([false, true]);
  });

  it("ignores empty or missing filter lists", () => {
    const nodes = [NODE("a"), NODE("b")];

    const empty = enrichRepoMapNodes(nodes, {
      data: DATA({ api: [] }),
      highlightKey: "api",
      hoveredNodeId: null,
      rawEdges: undefined,
    });
    expect(empty.map((n) => n.data.repoMap?.dimByFilter)).toEqual([false, false]);

    const missing = enrichRepoMapNodes(nodes, {
      data: DATA(),
      highlightKey: "api",
      hoveredNodeId: null,
      rawEdges: undefined,
    });
    expect(missing.map((n) => n.data.repoMap?.dimByFilter)).toEqual([false, false]);
  });

  it("preserves the existing search dim flag", () => {
    const nodes = [NODE("a", true), NODE("b")];

    const result = enrichRepoMapNodes(nodes, {
      data: DATA(),
      highlightKey: null,
      hoveredNodeId: null,
      rawEdges: undefined,
    });

    expect(result[0]?.data.repoMap?.dimBySearch).toBe(true);
    expect(result[1]?.data.repoMap?.dimBySearch).toBe(false);
  });

  it("applies hover and filter dimming together", () => {
    const nodes = [NODE("a"), NODE("b")];

    const result = enrichRepoMapNodes(nodes, {
      data: DATA({ api: ["a"] }),
      highlightKey: "api",
      hoveredNodeId: "a",
      rawEdges: undefined,
    });

    expect(result[0]?.data.repoMap).toEqual({
      dimByFilter: false,
      dimByHover: false,
      dimBySearch: false,
    });
    expect(result[1]?.data.repoMap).toEqual({
      dimByFilter: true,
      dimByHover: true,
      dimBySearch: false,
    });
  });
});
