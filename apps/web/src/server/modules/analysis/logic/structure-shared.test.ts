import { describe, expect, it } from "vitest";

import {
  createEmptyGroupEntry,
  isPathInsideScope,
  makeStructureNodeId,
  parseStructureNodeId,
  resolveImmediateChildScope,
} from "./structure-shared";

describe("createEmptyGroupEntry", () => {
  it("returns an empty entry with zeroed counters", () => {
    const entry = createEmptyGroupEntry();

    expect(entry.paths).toEqual([]);
    expect(entry.apiPaths).toEqual([]);
    expect(entry.configPaths).toEqual([]);
    expect(entry.semanticCounts).toEqual({
      api: 0,
      backend: 0,
      config: 0,
      core: 0,
      data: 0,
      frontend: 0,
      infrastructure: 0,
      ml: 0,
      mobile: 0,
      shared: 0,
      unknown: 0,
    });
  });
});

describe("makeStructureNodeId / parseStructureNodeId", () => {
  it("builds an id of nodeType:path", () => {
    expect(makeStructureNodeId("file", "src/app.ts")).toBe("file:src/app.ts");
    expect(makeStructureNodeId("group", "src/features")).toBe("group:src/features");
  });

  it("parses file and group ids", () => {
    expect(parseStructureNodeId("file:src/app.ts")).toEqual({
      nodeType: "file",
      path: "src/app.ts",
    });
    expect(parseStructureNodeId("group:src/features")).toEqual({
      nodeType: "group",
      path: "src/features",
    });
    expect(parseStructureNodeId("plain/path")).toEqual({
      nodeType: "group",
      path: "plain/path",
    });
  });
});

describe("isPathInsideScope", () => {
  it("includes the scope itself and nested paths", () => {
    expect(isPathInsideScope("src/features/user.ts", "src")).toBe(true);
    expect(isPathInsideScope("src", "src")).toBe(true);
  });

  it("excludes sibling and parent paths", () => {
    expect(isPathInsideScope("src/features/user.ts", "src/app")).toBe(false);
    expect(isPathInsideScope("src", "src/features")).toBe(false);
    expect(isPathInsideScope("srm/features/user.ts", "src")).toBe(false);
  });
});

describe("resolveImmediateChildScope", () => {
  it("returns file for a single-segment child", () => {
    expect(resolveImmediateChildScope("src", "src/app.ts")).toEqual({
      nodeType: "file",
      path: "src/app.ts",
    });
  });

  it("returns group for a multi-segment child", () => {
    expect(resolveImmediateChildScope("src", "src/features/user.ts")).toEqual({
      nodeType: "group",
      path: "src/features",
    });
  });

  it("returns null for paths outside scope", () => {
    expect(resolveImmediateChildScope("src", "lib/app.ts")).toBeNull();
    expect(resolveImmediateChildScope("src", "src2/app.ts")).toBeNull();
    expect(resolveImmediateChildScope("src", "src")).toBeNull();
  });
});
