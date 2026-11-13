import fs from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import {
  createParser,
  disposeTreeSitter,
  getSpecByExt,
  loadLanguage,
  parseSource,
  resolveGrammarWasmPath,
  TREE_SITTER_SUPPORTED_EXTENSIONS,
} from "./index";

const FIXTURES: Record<string, string> = {
  ".c": "int main(void) { return 0; }",
  ".cjs": "module.exports = 1;",
  ".cpp": "int main() { return 0; }",
  ".cs": "class A { static void Main() {} }",
  ".cts": "const x: number = 1;",
  ".erl": "-module(demo).\nmain() -> ok.\n",
  ".go": "package main\n\nfunc main() {}",
  ".java": "class A { public static void main(String[] args) {} }",
  ".jl": "function run(x)\n  x\nend\n",
  ".js": "const x = 1;",
  ".jsx": "const x = <div />;",
  ".kt": 'fun main() { println("x") }\n',
  ".lua": "local function f() end",
  ".m": "@interface A : NSObject\n@end",
  ".mjs": "export const x = 1;",
  ".mts": "const x: number = 1;",
  ".php": "<?php function f() {}",
  ".py": "def f():\n    pass",
  ".rb": 'require "x"\ndef run; end\n',
  ".rs": "fn main() {}",
  ".sh": "f() { echo hi; }",
  ".swift": "import Foundation\nfunc greet() {}\n",
  ".ts": "const x: number = 1;",
  ".tsx": "const x = <div />;",
};

describe("grammar smoke matrix", () => {
  afterAll(async () => {
    await disposeTreeSitter();
  });

  it.each(TREE_SITTER_SUPPORTED_EXTENSIONS)("resolves %s from tree-sitter-wasm", (ext) => {
    const spec = getSpecByExt(ext);
    if (spec == null) {
      throw new Error(`missing grammar spec for ${ext}`);
    }

    const wasmPath = resolveGrammarWasmPath(spec);

    expect(wasmPath).toContain(`node_modules/tree-sitter-wasm/out/${spec.wasmDir}/${spec.wasm}`);
    expect(fs.existsSync(wasmPath)).toBe(true);
  });

  it.each(TREE_SITTER_SUPPORTED_EXTENSIONS)("loads and parses %s without errors", async (ext) => {
    const fixture = FIXTURES[ext];
    expect(fixture, `missing smoke fixture for ${ext}`).toBeDefined();
    if (fixture == null) {
      throw new Error(`missing smoke fixture for ${ext}`);
    }

    const spec = getSpecByExt(ext);
    if (spec == null) {
      throw new Error(`missing grammar spec for ${ext}`);
    }

    const parser = await createParser();
    try {
      parser.setLanguage(await loadLanguage(ext, spec));
      const tree = parseSource(parser, fixture);
      if (tree == null) {
        throw new Error(`parser returned no tree for ${ext}`);
      }

      try {
        expect(tree.rootNode.hasError).toBe(false);
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });
});
