// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import type { RepoMapNodeData } from "./repo-map.types";
import {
  computeNodeDimensions,
  computeStrokeWidth,
  createLayoutEdges,
  createLayoutNodes,
} from "./use-map-layout";

describe("computeStrokeWidth", () => {
  it("defaults to 2 without a weight", () => {
    expect(computeStrokeWidth(undefined)).toBe(2);
  });

  it("treats a zero weight as unset", () => {
    expect(computeStrokeWidth(0)).toBe(2);
  });

  it("clamps low weights to 1.5", () => {
    expect(computeStrokeWidth(3)).toBe(1.5);
  });

  it("clamps high weights to 5", () => {
    expect(computeStrokeWidth(12)).toBe(5);
  });

  it("scales mid weights linearly", () => {
    expect(computeStrokeWidth(8)).toBe(4);
  });
});

describe("computeNodeDimensions", () => {
  it("uses standalone bases for a zero score", () => {
    expect(computeNodeDimensions(0)).toEqual({ height: 120, width: 240 });
  });

  it("uses grouped bases for a zero score", () => {
    expect(computeNodeDimensions(0, true)).toEqual({ height: 180, width: 320 });
  });

  it("grows height by score/2 capped at 30 and width by score capped at 60", () => {
    expect(computeNodeDimensions(40)).toEqual({ height: 140, width: 280 });
  });

  it("clamps extreme scores to the caps", () => {
    expect(computeNodeDimensions(100)).toEqual({ height: 150, width: 300 });
    expect(computeNodeDimensions(100, true)).toEqual({ height: 210, width: 380 });
  });
});

describe("createLayoutEdges", () => {
  const edges = createLayoutEdges([
    { id: "1", relation: "cycle", source: "a", target: "b", weight: 12 },
    { id: "2", relation: "risk", source: "b", target: "c", weight: 3 },
    { id: "3", relation: "import", source: "c", target: "d" },
    { id: "4", relation: "import", source: "d", target: "e", weight: 0 },
  ]);

  it("marks cycle edges as animated and labeled", () => {
    const cycle = edges.find((e) => e.id === "1");
    expect(cycle?.animated).toBe(true);
    expect(cycle?.label).toBe("cycle");
    expect(cycle?.style?.stroke).toBe("var(--status-error)");
    expect(cycle?.style?.strokeWidth).toBe(5);
  });

  it("labels risk edges and clamps their stroke width", () => {
    const risk = edges.find((e) => e.id === "2");
    expect(risk?.animated).toBe(false);
    expect(risk?.label).toBe("risk");
    expect(risk?.style?.stroke).toBe("var(--status-error)");
    expect(risk?.style?.strokeWidth).toBe(1.5);
  });

  it("leaves regular edges unlabeled with neutral styling", () => {
    const plain = edges.find((e) => e.id === "3");
    expect(plain?.animated).toBe(false);
    expect(plain?.label).toBeUndefined();
    expect(plain?.style?.stroke).toBe("var(--border-strong)");
    expect(plain?.style?.strokeWidth).toBe(2);
  });

  it("falls back to the default stroke width for a zero weight", () => {
    expect(edges.find((e) => e.id === "4")?.style?.strokeWidth).toBe(2);
  });
});

describe("createLayoutNodes", () => {
  it("places nodes at the origin with the repoNode type", () => {
    const input = [
      { id: "a", score: 0 } as RepoMapNodeData,
      { id: "b", score: 5 } as RepoMapNodeData,
    ];

    expect(createLayoutNodes(input)).toEqual([
      { data: input[0], id: "a", position: { x: 0, y: 0 }, type: "repoNode" },
      { data: input[1], id: "b", position: { x: 0, y: 0 }, type: "repoNode" },
    ]);
  });
});
