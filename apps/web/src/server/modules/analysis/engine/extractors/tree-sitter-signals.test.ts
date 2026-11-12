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
import { collectTypeScriptSignals } from "./typescript-signals";

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
      ".php",
      ".swift",
      ".cs",
    ]) {
      expect(TREE_SITTER_SUPPORTED_EXTENSIONS).toContain(ext);
    }
  });

  it(".ts → declarations of all five SymbolKinds + 1 neutral route pattern + typescript-wasm", () => {
    const spec = getSpecByExt(".ts");

    expect(spec?.declarations.map((declaration) => declaration.kind)).toEqual([
      "function",
      "class",
      "interface",
      "type",
      "enum",
    ]);
    expect(spec?.routePatterns?.map((route) => route.framework)).toEqual(["js-ts-router"]);
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
      parseError: false,
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

  it("emits one route per method and path and attributes Hono from imports", async () => {
    const result = await collectTreeSitterSignals({
      content: [
        'import { Hono } from "hono";',
        "const app = new Hono();",
        'app.get("/users", handler);',
        'app.post("/users", handler);',
        'app.get("/users", handler);',
      ].join("\n"),
      path: "src/api.ts",
    });

    expect(result?.routes).toHaveLength(2);
    expect(result?.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ framework: "Hono", method: "GET", path: "/users" }),
        expect.objectContaining({ framework: "Hono", method: "POST", path: "/users" }),
      ]),
    );
  });

  it.each([
    { framework: "Express", imports: 'import express from "express";', label: "express" },
    { framework: "Fastify", imports: 'import Fastify from "fastify";', label: "fastify" },
    {
      framework: "Fastify",
      imports: 'import fastifyPlugin from "fastify/plugin";',
      label: "fastify subpath",
    },
    {
      framework: "Hono",
      imports: 'import { Hono } from "hono";\nimport express from "express";',
      label: "hono alongside express",
    },
  ])("attributes routes from $label to $framework", async ({ framework, imports }) => {
    const result = await collectTreeSitterSignals({
      content: [imports, 'app.get("/users", handler);'].join("\n"),
      path: "src/api.ts",
    });

    expect(result?.routes?.[0]?.framework).toBe(framework);
  });

  it("leaves the framework undefined when no known router import is present", async () => {
    const result = await collectTreeSitterSignals({
      content: 'app.get("/users", handler);',
      path: "src/api.ts",
    });

    expect(result?.routes).toHaveLength(1);
    expect(result?.routes?.[0]?.framework).toBeUndefined();
  });

  it("uses the real C# wasm filename and does not advertise broken grammars", () => {
    expect(getSpecByExt(".cs")?.wasm).toBe("tree-sitter-c_sharp.wasm");
    expect(getSpecByExt(".erl")).toBeUndefined();
    expect(getSpecByExt(".jl")).toBeUndefined();
    expect(getSpecByExt(".kt")).toBeUndefined();
    expect(getSpecByExt(".rb")).toBeUndefined();
  });

  it("flags a partial parse instead of reporting full AST confidence", async () => {
    const result = await collectTreeSitterSignals({
      content: "class A { accessor x = 1; }",
      path: "src/partial.ts",
    });

    expect(result?.parseError).toBe(true);
    expect(result?.confidence).toBe(65);
  });

  it("propagates partial-parse confidence through the TypeScript adapter", async () => {
    const result = await collectTypeScriptSignals({
      content: "class A { accessor x = 1; }",
      path: "src/partial.ts",
    });

    expect(result.parseError).toBe(true);
    expect(result.confidence).toBe(65);
  });
});
