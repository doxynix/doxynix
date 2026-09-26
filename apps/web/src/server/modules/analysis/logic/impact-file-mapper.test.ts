import { describe, expect, it } from "vitest";

import type { PRChangedFileSnapshot } from "@/server/utils/types";

import type { TopLevelImpactNode } from "../analysis.mapper";
import { mapChangedFilesToImpactNodes } from "./impact-file-mapper";

function zone(id: string, path: string, label = id): TopLevelImpactNode {
  return { id, kind: "group", label, nodeType: "group", path };
}

function snapshot(overrides: Partial<PRChangedFileSnapshot> = {}): PRChangedFileSnapshot {
  return {
    additions: 1,
    deletions: 0,
    filePath: "src/a.ts",
    status: "modified",
    ...overrides,
  } as PRChangedFileSnapshot;
}

/**
 * `analyzeContext` arrives as a parameter, so a plain object is test data rather
 * than a mocked collaborator. Only `file:` node ids ever reach it.
 */
function contextWithNodes(nodes: Record<string, { label: string }>) {
  return {
    getStructureNode: (nodeId: string) => {
      const node = nodes[nodeId];
      return node == null ? null : { node };
    },
  } as never;
}

function run(params: {
  changedFiles: PRChangedFileSnapshot[];
  analyzeContext?: unknown;
  findingsByFile?: Map<string, number>;
  interestingPaths?: Set<string>;
  nodeById?: Map<string, TopLevelImpactNode>;
}) {
  return mapChangedFilesToImpactNodes({
    analyzeContext: (params.analyzeContext ?? contextWithNodes({})) as never,
    changedFiles: params.changedFiles,
    findingsByFile: params.findingsByFile ?? new Map(),
    interestingPaths: params.interestingPaths ?? new Set(),
    nodeById: params.nodeById ?? new Map(),
    nodeDetailCache: new Map(),
  });
}

describe("mapChangedFilesToImpactNodes", () => {
  it("normalises the file path before assigning a node id", () => {
    const [item] = run({
      changedFiles: [snapshot({ filePath: "./src/a.ts" })],
      interestingPaths: new Set(["src/a.ts"]),
    });

    expect(item?.filePath).toBe("src/a.ts");
    expect(item?.nodeId).toBe("file:src/a.ts");
  });

  it("opens the code view for a file the structure context tracks", () => {
    const [item] = run({
      changedFiles: [snapshot()],
      interestingPaths: new Set(["src/a.ts"]),
    });

    expect(item?.targetView).toBe("code");
  });

  it("opens the map view for a file the structure context does not track", () => {
    const [item] = run({
      changedFiles: [snapshot()],
      interestingPaths: new Set(["src/other.ts"]),
    });

    expect(item?.targetView).toBe("map");
  });

  it("resolves the containing zone for an untracked file", () => {
    const [item] = run({
      changedFiles: [snapshot({ filePath: "src/core/deep/new.ts" })],
      nodeById: new Map([["group:core", zone("group:core", "src/core", "Core")]]),
    });

    expect(item?.nodeId).toBe("group:core");
    expect(item?.zoneId).toBe("group:core");
    expect(item?.zoneLabel).toBe("Core");
  });

  it("picks the deepest containing zone", () => {
    const [item] = run({
      changedFiles: [snapshot({ filePath: "src/core/deep/new.ts" })],
      nodeById: new Map([
        ["group:src", zone("group:src", "src", "Source")],
        ["group:core", zone("group:core", "src/core", "Core")],
      ]),
    });

    expect(item?.zoneId).toBe("group:core");
  });

  it("resolves the renamed file's zone from its previous path when the new path matches nothing", () => {
    const [item] = run({
      changedFiles: [
        snapshot({ filePath: "packages/new-name.ts", previousFilePath: "src/core/old-name.ts" }),
      ],
      nodeById: new Map([["group:core", zone("group:core", "src/core", "Core")]]),
    });

    expect(item?.zoneId).toBe("group:core");
  });

  it("prefers the file's own path over its previous path", () => {
    const [item] = run({
      changedFiles: [
        snapshot({ filePath: "src/core/new.ts", previousFilePath: "apps/legacy/old.ts" }),
      ],
      nodeById: new Map([
        ["group:core", zone("group:core", "src/core", "Core")],
        ["group:legacy", zone("group:legacy", "apps/legacy", "Legacy")],
      ]),
    });

    expect(item?.zoneId).toBe("group:core");
  });

  it("prefers the direct file node over the zone node but still reports the zone", () => {
    const [item] = run({
      changedFiles: [snapshot()],
      interestingPaths: new Set(["src/a.ts"]),
      nodeById: new Map([["group:src", zone("group:src", "src", "Source")]]),
    });

    expect(item?.nodeId).toBe("file:src/a.ts");
    expect(item?.zoneId).toBe("group:src");
  });

  it("leaves node and zone null when nothing contains the file", () => {
    const [item] = run({
      changedFiles: [snapshot()],
      nodeById: new Map([["group:core", zone("group:core", "src/core", "Core")]]),
    });

    expect(item?.nodeId).toBeNull();
    expect(item?.nodeLabel).toBeNull();
    expect(item?.zoneId).toBeNull();
    expect(item?.zoneLabel).toBeNull();
  });

  it("labels a zone node straight from the node map", () => {
    const [item] = run({
      changedFiles: [snapshot()],
      nodeById: new Map([["group:src", zone("group:src", "src", "Source")]]),
    });

    expect(item?.nodeLabel).toBe("Source");
  });

  it("resolves a file node's label through the analyze context", () => {
    const [item] = run({
      analyzeContext: contextWithNodes({ "file:src/a.ts": { label: "a.ts" } }),
      changedFiles: [snapshot()],
      interestingPaths: new Set(["src/a.ts"]),
    });

    expect(item?.nodeLabel).toBe("a.ts");
  });

  it("falls back to a null label when the file node is unknown to the context", () => {
    const [item] = run({
      changedFiles: [snapshot()],
      interestingPaths: new Set(["src/a.ts"]),
    });

    expect(item?.nodeLabel).toBeNull();
  });

  it("reports the finding count for the normalized path", () => {
    const [item] = run({
      changedFiles: [snapshot({ filePath: "./src/a.ts" })],
      findingsByFile: new Map([["src/a.ts", 4]]),
    });

    expect(item?.findingCount).toBe(4);
  });

  it("defaults the finding count to zero", () => {
    const [item] = run({ changedFiles: [snapshot()] });

    expect(item?.findingCount).toBe(0);
  });

  it("preserves the snapshot fields it does not compute", () => {
    const [item] = run({
      changedFiles: [snapshot({ additions: 7, deletions: 3, status: "added" })],
    });

    expect(item).toMatchObject({ additions: 7, deletions: 3, status: "added" });
  });

  it("normalises the previous file path in the output", () => {
    const [item] = run({
      changedFiles: [snapshot({ previousFilePath: "./src/old.ts" })],
    });

    expect(item?.previousFilePath).toBe("src/old.ts");
  });

  it("leaves previousFilePath null when the file was not renamed", () => {
    const [item] = run({ changedFiles: [snapshot()] });

    expect(item?.previousFilePath).toBeNull();
  });

  it("maps every changed file independently", () => {
    const items = run({
      changedFiles: [
        snapshot({ filePath: "src/core/a.ts" }),
        snapshot({ filePath: "apps/web/b.ts" }),
      ],
      interestingPaths: new Set(["src/core/a.ts"]),
      nodeById: new Map([
        ["group:core", zone("group:core", "src/core", "Core")],
        ["group:web", zone("group:web", "apps/web", "Web")],
      ]),
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ nodeId: "file:src/core/a.ts", targetView: "code" });
    expect(items[1]).toMatchObject({ nodeId: "group:web", targetView: "map" });
  });

  it("returns an empty list for no changed files", () => {
    expect(run({ changedFiles: [] })).toEqual([]);
  });
});
