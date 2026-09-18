import { describe, expect, it } from "vitest";

import { collectRegexSignals } from "./regex-signals";

const file = (path: string, content = "") => ({ content, path });

const TS_FIXTURE = [
  'import lodash from "lodash";',
  "",
  "// export const LEGACY = 1;",
  "// function commented() {}",
  "",
  "export function handler() {",
  "  return 42;",
  "}",
  "",
  'export const VERSION = "1.0";',
  "",
  "interface User {",
  "  id: number;",
  "}",
  "",
  "class Service {}",
  "",
  "function helper() {}",
  "",
  "const mode = import.meta.env.MODE;",
].join("\n");

describe("collectRegexSignals", () => {
  describe("TypeScript file (DEFAULT spec)", () => {
    const signals = collectRegexSignals(file("src/app.ts", TS_FIXTURE));

    it("collects bare imports (quoted side-effect imports don't match the default spec)", () => {
      expect(signals.imports).toEqual(["lodash"]);
    });

    it("counts exports by export/function/class/interface lines and ignores comments", () => {
      // export function, export const, interface User, class Service, function helper
      expect(signals.exports).toBe(5);
    });

    it("finds function/class/interface symbols with export confidence", () => {
      const names = signals.symbols ?? [];
      expect(names.map((symbol) => symbol.name)).toEqual(["helper", "Service", "User"]);
      for (const symbol of names) {
        expect(symbol.exported).toBe(true);
        expect(symbol.confidence).toBe(75);
        expect(symbol.path).toBe("src/app.ts");
      }
      expect(names[0]?.kind).toBe("function");
      expect(names[1]?.kind).toBe("class");
      expect(names[2]?.kind).toBe("interface");
    });

    it("gives no apiSurface or routes for the default spec", () => {
      expect(signals.apiSurface).toBe(0);
      expect(signals.routes).toEqual([]);
    });

    it("does not treat import.meta.env as code (entrypointHint=false) and keeps base fields", () => {
      expect(signals.entrypointHint).toBe(false);
      expect(signals.analysisMode).toBe("heuristic");
      expect(signals.confidence).toBe(60);
      expect(signals.source).toBe("extraction");
      expect(signals.complexityMetrics).toEqual({ complexity: 0, maxNesting: 0 });
      expect(signals.path).toBe("src/app.ts");
      expect(signals.frameworkHints).toBeDefined();
    });

    it("reports symbol lines (offset by 1 due to ^ + \\s*)", () => {
      const helper = (signals.symbols ?? []).find((symbol) => symbol.name === "helper");

      expect(helper?.line).toBe(17);
    });
  });

  describe("Python FastAPI file", () => {
    const PY_FIXTURE = [
      "from fastapi import FastAPI",
      "import os",
      "",
      "app = FastAPI()",
      "",
      '@app.get("/items")',
      "def list_items():",
      "    return []",
      "",
      "class Item:",
      "    pass",
      "",
      'if __name__ == "__main__":',
      "    pass",
    ].join("\n");

    const signals = collectRegexSignals(file("src/app.py", PY_FIXTURE));

    it("collects imports in pattern order: import lines before from lines", () => {
      expect(signals.imports).toEqual(["os", "fastapi"]);
    });

    it("counts exports: def and class", () => {
      expect(signals.exports).toBe(2);
    });

    it("counts apiSurface only from @app/decorator routes", () => {
      expect(signals.apiSurface).toBe(1);
    });

    it("extracts the FastAPI route with method, path, and line", () => {
      expect(signals.routes).toHaveLength(1);
      const route = signals.routes?.[0];
      expect(route).toMatchObject({
        confidence: 65,
        framework: "FastAPI",
        kind: "http",
        line: 6,
        method: "GET",
        path: "/items",
        sourcePath: "src/app.py",
      });
    });

    it("extracts function/class symbols", () => {
      const names = (signals.symbols ?? []).map((symbol) => symbol.name);
      expect(names).toEqual(["list_items", "Item"]);
      expect((signals.symbols ?? [])[0]?.kind).toBe("function");
      expect((signals.symbols ?? [])[1]?.kind).toBe("class");
    });

    it("recognizes the __main__ entry point", () => {
      expect(signals.entrypointHint).toBe(true);
    });

    it("collects the FastAPI framework fact from import tokens", () => {
      expect(signals.frameworkHints).toContainEqual(
        expect.objectContaining({ category: "framework", confidence: 88, name: "FastAPI" }),
      );
    });
  });

  describe("Go file", () => {
    const GO_FIXTURE = [
      "package main",
      "",
      "import (",
      '\t"log"',
      ")",
      "",
      "func main() {",
      '\trouter.GET("/healthz", healthz)',
      '\trouter.POST("/api/v1/users", createUser)',
      "}",
    ].join("\n");

    const signals = collectRegexSignals(file("cmd/server/main.go", GO_FIXTURE));

    it("collects the import from block require format (standalone line)", () => {
      expect(signals.imports).toEqual(["log"]);
    });

    it("counts apiSurface with double matching of router.GET (actual behavior)", () => {
      // both GET(...) and router.GET(...) match each route: 2 routes * 2 patterns = 4
      expect(signals.apiSurface).toBe(4);
    });

    it("counts exports only for exported (uppercase) functions — main is not an export", () => {
      // `main` starts with a lowercase letter → doesn't match [A-Z]\w* (Go export rule)
      expect(signals.exports).toBe(0);
    });

    it("does not find main as a symbol (lowercase letter is not an export)", () => {
      expect(signals.symbols ?? []).toEqual([]);
    });

    it("extracts 2 Gin routes", () => {
      expect(signals.routes).toHaveLength(2);
      expect(signals.routes?.[0]).toMatchObject({
        framework: "Gin",
        method: "GET",
        path: "/healthz",
      });
      expect(signals.routes?.[1]).toMatchObject({
        framework: "Gin",
        method: "POST",
        path: "/api/v1/users",
      });
    });

    it("recognizes package main + func main as the entry point", () => {
      expect(signals.entrypointHint).toBe(true);
    });
  });

  describe("Ruby file", () => {
    const RB_FIXTURE = [
      'require "json"',
      "",
      "class UsersController",
      "  def index",
      "  end",
      "end",
      "",
      'get "/users" do',
      '  "ok"',
      "end",
    ].join("\n");

    const signals = collectRegexSignals(file("app/routes.rb", RB_FIXTURE));

    it("collects require imports", () => {
      expect(signals.imports).toEqual(["json"]);
    });

    it("counts exports: class and def", () => {
      expect(signals.exports).toBe(2);
    });

    it("counts apiSurface and extracts the Ruby Router route", () => {
      expect(signals.apiSurface).toBe(1);
      expect(signals.routes).toHaveLength(1);
      expect(signals.routes?.[0]).toMatchObject({
        framework: "Ruby Router",
        line: 7,
        method: "GET",
        path: "/users",
      });
    });

    it("finds class and method functions", () => {
      expect((signals.symbols ?? []).map((symbol) => symbol.name)).toEqual([
        "UsersController",
        "index",
      ]);
    });
  });

  describe("edge cases", () => {
    it("empty file → zero counters without throw", () => {
      const signals = collectRegexSignals(file("src/empty.ts", ""));

      expect(signals).toMatchObject({
        analysisMode: "heuristic",
        apiSurface: 0,
        complexityMetrics: { complexity: 0, maxNesting: 0 },
        entrypointHint: false,
        exports: 0,
        imports: [],
        routes: [],
        symbols: [],
      });
    });

    it("does not crash on various extensions and extensionless paths", () => {
      for (const path of ["README.md", "src/index.tsx", "index.html", "data.txt", "Makefile"]) {
        expect(() => collectRegexSignals(file(path, "anything here"))).not.toThrow();
      }
    });

    it("does not count commented-out code", () => {
      const signals = collectRegexSignals(
        file(
          "src/commented.ts",
          ["// export const X = 1;", "// function ghost() {}", "/* export const Y = 2; */"].join(
            "\n",
          ),
        ),
      );

      expect(signals.exports).toBe(0);
      expect(signals.symbols).toEqual([]);
    });
  });
});
