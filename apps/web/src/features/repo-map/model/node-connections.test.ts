import { describe, expect, it } from "vitest";

import { deriveNodeConnections } from "./node-connections";

const NODE = {
  id: "src/app.ts",
  label: "app.ts",
  path: "src/app.ts",
  previewPaths: ["src/app.ts", "src/lib/api.ts"],
};

const base = {
  children: [{ id: "src/lib/child.ts" }],
  explain: {
    nextSuggestedPaths: ["src/lib/child.ts", "src/feature.ts", "src/lib/api.ts"],
    sourcePaths: ["src/lib/api.ts"],
  },
  inspect: {
    relatedPaths: ["src/other.ts", "src/app.ts"],
    samplePaths: ["src/lib/api.ts"],
  },
  node: NODE,
};

describe("deriveNodeConnections", () => {
  it("returns an empty list when nothing is suggested or related", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: [] },
      inspect: { ...base.inspect, relatedPaths: [] },
    });
    expect(result.connections).toEqual([]);
  });

  it("drops paths pointing at the node itself by id", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: [] },
      inspect: { ...base.inspect, relatedPaths: ["src/app.ts"] },
    });
    expect(result.connections).toEqual([]);
  });

  it("drops the node's own path even when the id differs", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: [] },
      inspect: { ...base.inspect, relatedPaths: ["src/app.ts"] },
      node: { ...NODE, id: "file:src/app.ts" },
    });
    expect(result.connections).toEqual([]);
  });

  it("drops child ids from navigation", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: ["src/lib/child.ts"] },
      inspect: { ...base.inspect, relatedPaths: [] },
    });
    expect(result.connections).toEqual([]);
  });

  it("drops references that are already internal file names", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: [] },
      inspect: { ...base.inspect, relatedPaths: ["src/lib/api.ts"] },
    });
    expect(result.connections).toEqual([]);
  });

  it("drops a path whose basename equals the node label", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: ["src/feature/app.ts"] },
      inspect: { ...base.inspect, relatedPaths: [] },
    });
    expect(result.connections).toEqual([]);
  });

  it("dedupes the joined navigation and related lists", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: ["src/feature.ts", "src/kept.ts"] },
      inspect: { ...base.inspect, relatedPaths: ["src/feature.ts"] },
    });
    expect(result.connections).toEqual(["src/feature.ts", "src/kept.ts"]);
  });

  it("keeps a unique external path", () => {
    const result = deriveNodeConnections({
      ...base,
      explain: { ...base.explain, nextSuggestedPaths: [] },
      inspect: { ...base.inspect, relatedPaths: ["src/unique.ts"] },
    });
    expect(result.connections).toEqual(["src/unique.ts"]);
  });

  it("collects deduped internal file references excluding the node label", () => {
    const result = deriveNodeConnections(base);
    expect(result.allFileReferences).toEqual(["api.ts"]);
  });
});
