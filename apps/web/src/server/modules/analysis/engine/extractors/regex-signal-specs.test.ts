import { describe, expect, it } from "vitest";

import { getRegexSignalSpec } from "./regex-signal-specs";

const file = (path: string, content = "") => ({ content, path });

describe("getRegexSignalSpec", () => {
  describe("spec selection by extension", () => {
    it("returns the .cs spec with ASP.NET Core routes and Map*-apiSurface", () => {
      const spec = getRegexSignalSpec(file("src/Program.cs"));

      expect(spec.apiSurfacePatterns).toHaveLength(2);
      expect(spec.routePatterns?.[0]?.framework).toBe("ASP.NET Core");
      expect(spec.importPatterns).toHaveLength(1);
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["class", "interface"]);
    });

    it("returns the .dart spec without routePatterns", () => {
      const spec = getRegexSignalSpec(file("lib/main.dart"));

      expect(spec.routePatterns).toBeUndefined();
      expect(spec.exportPatterns.length).toBeGreaterThan(0);
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["class", "function"]);
    });

    it("returns the .go spec with Gin routes", () => {
      const spec = getRegexSignalSpec(file("cmd/server/main.go"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Gin");
      expect(spec.routePatterns?.[0]?.pattern).toBeDefined();
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["function", "struct"]);
    });

    it("returns the .java spec with Spring Boot routes", () => {
      const spec = getRegexSignalSpec(file("src/main/java/App.java"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Spring Boot");
      expect(spec.apiSurfacePatterns.some((pattern) => pattern.source.includes("Mapping"))).toBe(
        true,
      );
    });

    it("returns the .php spec with Laravel routes", () => {
      const spec = getRegexSignalSpec(file("routes/web.php"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Laravel");
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["class", "function"]);
    });

    it("returns the .py spec with two FastAPI route patterns and extraFrameworkTokens", () => {
      const spec = getRegexSignalSpec(file("src/app.py"));

      expect(spec.routePatterns).toHaveLength(2);
      for (const route of spec.routePatterns ?? []) {
        expect(route.framework).toBe("FastAPI");
      }
      expect(typeof spec.extraFrameworkTokens).toBe("function");
      expect(spec.apiSurfacePatterns).toHaveLength(3);
    });

    it("returns the .rb spec with Ruby Router routes", () => {
      const spec = getRegexSignalSpec(file("app/controllers/x.rb"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Ruby Router");
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual([
        "class",
        "module",
        "function",
      ]);
    });

    it("returns the .rs spec with Axum routes and trait/struct symbols", () => {
      const spec = getRegexSignalSpec(file("src/main.rs"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Axum");
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual([
        "function",
        "struct",
        "trait",
      ]);
    });

    it("returns the .scala and .swift specs without routePatterns", () => {
      expect(getRegexSignalSpec(file("Main.scala")).routePatterns).toBeUndefined();
      expect(getRegexSignalSpec(file("Main.swift")).routePatterns).toBeUndefined();
    });
  });

  describe("extension aliases", () => {
    it("maps C-family extensions to the c-family spec", () => {
      for (const ext of [".cc", ".cpp", ".h", ".hpp"]) {
        const spec = getRegexSignalSpec(file(`src/main${ext}`));
        expect(spec.importPatterns[0]!.source).toBe(/^\s*#include\s+"([^"]+)"/u.source);
        expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["function"]);
      }
    });

    it(".c not in aliases → DEFAULT spec (fact)", () => {
      const spec = getRegexSignalSpec(file("src/main.c"));
      expect(spec.routePatterns).toBeUndefined();
      expect(spec.apiSurfacePatterns).toEqual([]);
    });

    it("maps .kt/.kts to the .java spec", () => {
      for (const ext of [".kt", ".kts"]) {
        const spec = getRegexSignalSpec(file(`src/App${ext}`));
        expect(spec.routePatterns?.[0]?.framework).toBe("Spring Boot");
      }
    });

    it("maps .bsl/.os to the 1c spec and .ex/.exs to the elixir spec", () => {
      const oneCSpec = getRegexSignalSpec(file("src/module.bsl"));
      expect(oneCSpec.extraFrameworkTokens?.({ content: "", path: "src/module.os" })).toEqual([
        "1C:Enterprise",
      ]);

      const elixirSpec = getRegexSignalSpec(file("lib/app.ex"));
      expect(elixirSpec.routePatterns?.[0]?.framework).toBe("Phoenix");
    });
  });

  describe("unknown extension → DEFAULT spec", () => {
    it("returns the default set for .xyz extensions", () => {
      const spec = getRegexSignalSpec(file("src/unknown.xyz"));

      expect(spec.apiSurfacePatterns).toEqual([]);
      expect(spec.exportPatterns).toHaveLength(2);
      expect(spec.importPatterns).toHaveLength(4);
      expect(spec.routePatterns).toBeUndefined();
      expect(spec.symbolPatterns).toHaveLength(3);
      expect(spec.entrypointHint(file("src/unknown.xyz"))).toBe(false);
    });

    it("also returns DEFAULT for extensionless paths", () => {
      const spec = getRegexSignalSpec(file("Makefile"));

      expect(spec.apiSurfacePatterns).toEqual([]);
      expect(spec.routePatterns).toBeUndefined();
    });

    it("returns DEFAULT for uppercase extensions (case-sensitive lookup)", () => {
      const spec = getRegexSignalSpec(file("src/App.TS"));

      expect(spec.apiSurfacePatterns).toEqual([]);
      expect(spec.routePatterns).toBeUndefined();
    });
  });

  describe("spec regex patterns against real strings", () => {
    it(".go Router route: method and path capture groups", () => {
      const spec = getRegexSignalSpec(file("main.go"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      expect(pattern).toBeDefined();

      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('router.GET("/healthz", handler)');
      expect(match?.[1]).toBe("GET");
      expect(match?.[2]).toBe("/healthz");
    });

    it(".py FastAPI routes: @app.get and @router.post", () => {
      const spec = getRegexSignalSpec(file("app.py"));
      const patterns = (spec.routePatterns ?? []).map((route) => {
        return new RegExp(route.pattern.source, route.pattern.flags);
      });

      const routerPost = patterns[0]!.exec('@router.post("/users")');
      expect(routerPost?.[1]).toBe("post");
      expect(routerPost?.[2]).toBe("/users");

      const appGet = patterns[1]!.exec('@app.get("/items")');
      expect(appGet?.[1]).toBe("get");
      expect(appGet?.[2]).toBe("/items");
    });

    it(".cs MapGet: method and path capture groups", () => {
      const spec = getRegexSignalSpec(file("Program.cs"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('app.MapGet("/api/items", handler)');

      expect(match?.[1]).toBe("Get");
      expect(match?.[2]).toBe("/api/items");
    });

    it('.rs Axum route: #[get("/x")]', () => {
      const spec = getRegexSignalSpec(file("main.rs"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('#[get("/widgets")]');

      expect(match?.[1]).toBe("get");
      expect(match?.[2]).toBe("/widgets");
    });

    it('.php Laravel route: Route::get(" /users")', () => {
      const spec = getRegexSignalSpec(file("web.php"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('Route::get("/users", "UserController@index")');

      expect(match?.[1]).toBe("get");
      expect(match?.[2]).toBe("/users");
    });

    it("DEFAULT: export lines and non-wrapping imports", () => {
      const spec = getRegexSignalSpec(file("src/a.ts"));

      const exportPattern = new RegExp(
        spec.exportPatterns[0]!.source,
        spec.exportPatterns[0]!.flags,
      );
      expect(exportPattern.test("export const x = 1;")).toBe(true);

      const importPattern = new RegExp(
        spec.importPatterns[0]!.source,
        spec.importPatterns[0]!.flags,
      );
      expect(importPattern.exec('import lodash from "lodash"')?.[1]).toBe("lodash");
      // quoted side-effect imports are not collected by the default spec — `"` is not in [\w./-]
      expect(importPattern.exec('import "./styles.css";')).toBeNull();
    });
  });

  describe("entrypointHint", () => {
    it(".cs: static void Main and WebApplication.CreateBuilder", () => {
      const spec = getRegexSignalSpec(file("Program.cs"));

      expect(spec.entrypointHint(file("Program.cs", "static void Main(string[] args) {}"))).toBe(
        true,
      );
      expect(
        spec.entrypointHint(
          file("Program.cs", "var builder = WebApplication.CreateBuilder(args);"),
        ),
      ).toBe(true);
      expect(spec.entrypointHint(file("Program.cs", "class Helper {}"))).toBe(false);
    });

    it('.py: if __name__ == "__main__"', () => {
      const spec = getRegexSignalSpec(file("run.py"));

      expect(spec.entrypointHint(file("run.py", 'if __name__ == "__main__":\n  main()'))).toBe(
        true,
      );
      expect(spec.entrypointHint(file("run.py", "def main(): pass"))).toBe(false);
    });

    it(".go: package main + func main", () => {
      const spec = getRegexSignalSpec(file("main.go"));

      expect(spec.entrypointHint(file("main.go", "package main\n\nfunc main() {}"))).toBe(true);
      expect(spec.entrypointHint(file("main.go", "package main\n\nfunc helper() {}"))).toBe(false);
    });

    it(".java: public static void main", () => {
      const spec = getRegexSignalSpec(file("App.java"));

      expect(
        spec.entrypointHint(file("App.java", "public static void main(String[] args) {}")),
      ).toBe(true);
      expect(spec.entrypointHint(file("App.java", "class App {}"))).toBe(false);
    });

    it(".swift: @main; .rb: run/start in basename or config.ru", () => {
      const swiftSpec = getRegexSignalSpec(file("main.swift"));
      expect(swiftSpec.entrypointHint(file("main.swift", "@main struct App {}"))).toBe(true);
      expect(swiftSpec.entrypointHint(file("main.swift", "import UIKit"))).toBe(false);

      const rubyspec = getRegexSignalSpec(file("bin/run.rb"));
      expect(rubyspec.entrypointHint(file("bin/run.rb", "require 'app'"))).toBe(true);
      expect(rubyspec.entrypointHint(file("config.ru", ""))).toBe(true);
      expect(rubyspec.entrypointHint(file("app.rb", "require 'app'"))).toBe(false);
    });

    it(".php: index.php by file name", () => {
      const spec = getRegexSignalSpec(file("public/index.php"));

      expect(spec.entrypointHint(file("public/index.php", "<?php echo 1;"))).toBe(true);
      expect(spec.entrypointHint(file("public/router.php", "<?php echo 1;"))).toBe(false);
    });

    it("1c: application modules in path", () => {
      const spec = getRegexSignalSpec(file("ManagedApplicationModule.bsl"));

      expect(
        spec.entrypointHint(
          file("src/ManagedApplicationModule.bsl", "Процедура УстановитьПараметры()"),
        ),
      ).toBe(true);
      expect(spec.entrypointHint(file("src/Calculator.bsl", "Процедура Вычислить()"))).toBe(false);
    });

    it("c-family: int main", () => {
      const spec = getRegexSignalSpec(file("main.cpp"));

      expect(spec.entrypointHint(file("main.cpp", "int main(void) { return 0; }"))).toBe(true);
      expect(spec.entrypointHint(file("main.cpp", "int helper(void) { return 0; }"))).toBe(false);
    });
  });

  describe("extraFrameworkTokens", () => {
    it(".py: collects framework names from content", () => {
      const spec = getRegexSignalSpec(file("app.py"));

      const tokens = spec.extraFrameworkTokens?.(
        file("app.py", "app = FastAPI()\nrouter = APIRouter()\nfrom flask import Flask"),
      );

      expect(tokens).toEqual(["FastAPI", "APIRouter", "Flask"]);
    });

    it(".py: returns an empty list without framework tokens", () => {
      const spec = getRegexSignalSpec(file("app.py"));

      expect(spec.extraFrameworkTokens?.(file("app.py", "import os"))).toEqual([]);
    });

    it("1c: always returns the 1C:Enterprise token", () => {
      const spec = getRegexSignalSpec(file("src/module.bsl"));

      expect(spec.extraFrameworkTokens?.(file("src/module.bsl", ""))).toEqual(["1C:Enterprise"]);
    });
  });
});
