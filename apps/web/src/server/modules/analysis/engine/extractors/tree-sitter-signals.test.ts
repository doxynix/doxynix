import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { getSpecByExt, TREE_SITTER_SUPPORTED_EXTENSIONS } from "@/server/core/tree-sitter";

import { collectTreeSitterSignals } from "./tree-sitter-signals";

describe("tree-sitter-signals: spec contract (without wasm)", () => {
  it("exports the expected list of supported extensions", () => {
    for (const ext of [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".go",
      ".py",
      ".rs",
      ".java",
      ".rb",
      ".php",
      ".swift",
      ".kt",
      ".cs",
    ]) {
      expect(TREE_SITTER_SUPPORTED_EXTENSIONS).toContain(ext);
    }
  });

  it(".ts → declarations of all five SymbolKinds + 3 route patterns + typescript-wasm", () => {
    const spec = getSpecByExt(".ts");

    expect(spec?.declarations.map((declaration) => declaration.kind)).toEqual([
      "function",
      "class",
      "interface",
      "type",
      "enum",
    ]);
    expect(spec?.routePatterns?.map((route) => route.framework)).toEqual([
      "Hono",
      "Express",
      "Fastify",
    ]);
    expect(spec?.wasm).toBe("tree-sitter-typescript.wasm");
    expect(spec?.entrypoints.length).toBeGreaterThan(0);
  });

  it(".py → FastAPI/Flask + Django route patterns and python-wasm", () => {
    const spec = getSpecByExt(".py");

    expect(spec?.routePatterns?.map((route) => route.framework)).toEqual([
      "FastAPI/Flask",
      "Django",
    ]);
    expect(spec?.wasm).toBe("tree-sitter-python.wasm");
    expect(spec?.wasmPackage).toBe("tree-sitter-python");
  });

  it(".go → Gin/Echo route patterns and go-wasm", () => {
    const spec = getSpecByExt(".go");

    expect(spec?.routePatterns?.map((route) => route.framework)).toEqual(["Gin", "Echo", "Echo"]);
    expect(spec?.wasm).toBe("tree-sitter-go.wasm");
  });

  it(".rs → Axum/Actix route pattern and Rust declaration types", () => {
    const spec = getSpecByExt(".rs");

    expect(spec?.routePatterns?.[0]?.framework).toBe("Axum/Actix");
    expect(spec?.declarations.map((declaration) => declaration.kind)).toEqual([
      "function",
      "struct",
      "trait",
      "module",
    ]);
  });

  it("unknown/empty extension → undefined", () => {
    expect(getSpecByExt(".unknown")).toBeUndefined();
    expect(getSpecByExt("")).toBeUndefined();
  });

  it("collectTreeSitterSignals parses AST in unit environment (wasm available)", async () => {
    const result = await collectTreeSitterSignals({
      content: 'package main\n\nfunc main() {\n\tprintln("hi")\n}\n',
      path: "src/main.go",
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      analysisMode: "tree-sitter",
      entrypointHint: true,
      exports: 0,
      source: "extraction",
    });
    expect(result?.frameworkHints).toBeDefined();
  });

  it("extracts real symbol names and 1-based lines for TypeScript declarations", async () => {
    const result = await collectTreeSitterSignals({
      content: [
        "export function greet(name: string) { return name; }",
        "class UserService { run() {} }",
        "interface UserRepo { find(): void }",
        "type Id = string;",
        "enum Role { Admin }",
      ].join("\n"),
      path: "src/sample.ts",
    });

    expect(result?.symbols?.map((symbol) => symbol.name)).toEqual([
      "greet",
      "UserService",
      "run",
      "UserRepo",
      "Id",
      "Role",
    ]);
    expect(result?.symbols?.map((symbol) => symbol.line)).toEqual([1, 2, 2, 3, 4, 5]);
  });

  it("marks only exported declarations and counts unique exported names", async () => {
    const result = await collectTreeSitterSignals({
      content: [
        "export function a() {}",
        "function b() {}",
        "const c = () => 1;",
        "export const e = () => 1;",
        "export { b as publicB };",
        "export default class D {}",
      ].join("\n"),
      path: "src/exports.ts",
    });

    const byName = new Map((result?.symbols ?? []).map((symbol) => [symbol.name, symbol]));
    expect(byName.get("a")?.exported).toBe(true);
    expect(byName.get("b")?.exported).toBe(true);
    expect(byName.get("c")?.exported).toBe(false);
    expect(byName.get("D")?.exported).toBe(true);
    expect(byName.get("e")?.exported).toBe(true);
    expect(result?.exports).toBe(4);
  });
});
