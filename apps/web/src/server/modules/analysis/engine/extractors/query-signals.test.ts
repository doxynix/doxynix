import { describe, expect, it } from "vitest";

import type { ImportRef } from "../core/discovery.types";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";
import { typescriptQuerySpec } from "./queries/typescript";
import { collectQuerySignals } from "./query-signals";

const FIXTURE = [
  'import { Hono } from "hono";',
  "export function greet(name: string) { return name; }",
  "function internal() {}",
  "class UserService { run() {} }",
  'const app = new Hono(); app.get("/users", handler);',
].join("\n");

const IMPORT_FIXTURE = [
  'import { Hono } from "hono";',
  'import DefaultExport, { named } from "x";',
  'import "side-effect";',
  'import * as ns from "y";',
  'const z = require("./z");',
  'const d = import("./dyn");',
  'export { anything } from "./reexported";',
].join("\n");

const NESTING_FIXTURE = [
  "function check(items: number[]) {",
  "  if (items.length === 0) {",
  "    return;",
  "  }",
  "  for (const item of items) {",
  "    if (item > 0) {",
  "      return;",
  "    }",
  "  }",
  "}",
].join("\n");

const ENTRYPOINT_FIXTURE = ['import { Hono } from "hono";', "const app = new Hono();"].join("\n");

function describeImport(details: readonly ImportRef[] | undefined) {
  return (details ?? []).map(({ kind, names, source }) => ({ kind, names, source }));
}

describe("collectQuerySignals", () => {
  it("normalizes symbols, imports, exports and routes", async () => {
    const result = await collectQuerySignals(
      { content: FIXTURE, path: "src/api.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(result).not.toBeNull();
    expect(result?.analysisMode).toBe("tree-sitter");
    expect(result?.confidence).toBe(CONFIDENCE_LEVELS.astStructure);
    expect(result?.symbols?.map((symbol) => symbol.name)).toEqual([
      "greet",
      "internal",
      "UserService",
      "run",
    ]);
    expect(result?.symbols?.find((symbol) => symbol.name === "greet")?.exported).toBe(true);
    expect(result?.symbols?.find((symbol) => symbol.name === "internal")?.exported).toBe(false);
    expect(result?.imports).toEqual(["hono"]);
    expect(result?.exports).toBe(1);
    expect(result?.routes).toEqual([
      expect.objectContaining({ framework: "Hono", method: "GET", path: "/users" }),
    ]);
    expect(result?.parseError).toBe(false);
    expect(result?.entrypointHint).toBe(true);
  });

  it("groups one import detail per statement", async () => {
    const result = await collectQuerySignals(
      { content: IMPORT_FIXTURE, path: "src/imports.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(describeImport(result?.importDetails)).toEqual([
      { kind: "named", names: ["Hono"], source: "hono" },
      { kind: "named", names: ["DefaultExport", "named"], source: "x" },
      { kind: "side-effect", names: [], source: "side-effect" },
      { kind: "namespace", names: ["ns"], source: "y" },
      { kind: "require", names: [], source: "./z" },
      { kind: "dynamic", names: [], source: "./dyn" },
      { kind: "reexport", names: [], source: "./reexported" },
    ]);
    expect(result?.imports).toEqual([
      "hono",
      "x",
      "side-effect",
      "y",
      "./z",
      "./dyn",
      "./reexported",
    ]);
  });

  it("counts complexity and nesting depth", async () => {
    const result = await collectQuerySignals(
      { content: NESTING_FIXTURE, path: "src/nesting.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(result?.complexityMetrics.complexity).toBeGreaterThanOrEqual(2);
    expect(result?.complexityMetrics.maxNesting).toBeGreaterThanOrEqual(2);
  });

  it("flags runtime entrypoints", async () => {
    const result = await collectQuerySignals(
      { content: ENTRYPOINT_FIXTURE, path: "src/server.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(result?.entrypointHint).toBe(true);
    expect(result?.entrypointRefs).toHaveLength(1);
    expect(result?.entrypointRefs?.[0]).toEqual(
      expect.objectContaining({ kind: "runtime", path: "src/server.ts" }),
    );
  });

  it("returns null for an unsupported extension", async () => {
    const result = await collectQuerySignals(
      { content: "module x", path: "src/module.unknown" },
      ".unknown",
      typescriptQuerySpec,
    );

    expect(result).toBeNull();
  });

  it("records the raw signature and parameters for a function", async () => {
    const result = await collectQuerySignals(
      {
        content: "export function greet(name: string, age?: number): string { return name; }",
        path: "src/sample.ts",
      },
      ".ts",
      typescriptQuerySpec,
    );

    const symbol = result?.symbols?.find((item) => item.name === "greet");
    expect(symbol?.signature).toContain("greet(name: string");
    expect(symbol?.parameters).toBe("(name: string, age?: number)");
    expect(symbol?.returnType).toBe(": string");
  });
});
