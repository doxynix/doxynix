import { describe, expect, it } from "vitest";

import {
  createEmptyGroupEntry,
  isPathInsideScope,
  makeStructureNodeId,
  parseStructureNodeId,
  resolveImmediateChildScope,
} from "./structure-shared";

describe("createEmptyGroupEntry", () => {
  it("возвращает пустую запись с нулевыми счётчиками", () => {
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
  it("формирует id nodeType:path", () => {
    expect(makeStructureNodeId("file", "src/app.ts")).toBe("file:src/app.ts");
    expect(makeStructureNodeId("group", "src/features")).toBe("group:src/features");
  });

  it("парсит файловые и групповые id", () => {
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
  it("включает сам scope и вложенные пути", () => {
    expect(isPathInsideScope("src/features/user.ts", "src")).toBe(true);
    expect(isPathInsideScope("src", "src")).toBe(true);
  });

  it("исключает соседние и родительские пути", () => {
    expect(isPathInsideScope("src/features/user.ts", "src/app")).toBe(false);
    expect(isPathInsideScope("src", "src/features")).toBe(false);
    expect(isPathInsideScope("srm/features/user.ts", "src")).toBe(false);
  });
});

describe("resolveImmediateChildScope", () => {
  it("возвращает file для односегментного потомка", () => {
    expect(resolveImmediateChildScope("src", "src/app.ts")).toEqual({
      nodeType: "file",
      path: "src/app.ts",
    });
  });

  it("возвращает group для многосегментного потомка", () => {
    expect(resolveImmediateChildScope("src", "src/features/user.ts")).toEqual({
      nodeType: "group",
      path: "src/features",
    });
  });

  it("возвращает null для путей вне scope", () => {
    expect(resolveImmediateChildScope("src", "lib/app.ts")).toBeNull();
    expect(resolveImmediateChildScope("src", "src2/app.ts")).toBeNull();
    expect(resolveImmediateChildScope("src", "src")).toBeNull();
  });
});
