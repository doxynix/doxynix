import { describe, expect, it } from "vitest";

import { getRegexSignalSpec } from "./regex-signal-specs";

const file = (path: string, content = "") => ({ content, path });

describe("getRegexSignalSpec", () => {
  describe("выбор спеки по расширению", () => {
    it("возвращает .cs-спеку с ASP.NET Core роутами и Map*-apiSurface", () => {
      const spec = getRegexSignalSpec(file("src/Program.cs"));

      expect(spec.apiSurfacePatterns).toHaveLength(2);
      expect(spec.routePatterns?.[0]?.framework).toBe("ASP.NET Core");
      expect(spec.importPatterns).toHaveLength(1);
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["class", "interface"]);
    });

    it("возвращает .dart-спеку без routePatterns", () => {
      const spec = getRegexSignalSpec(file("lib/main.dart"));

      expect(spec.routePatterns).toBeUndefined();
      expect(spec.exportPatterns.length).toBeGreaterThan(0);
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["class", "function"]);
    });

    it("возвращает .go-спеку с Gin-роутами", () => {
      const spec = getRegexSignalSpec(file("cmd/server/main.go"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Gin");
      expect(spec.routePatterns?.[0]?.pattern).toBeDefined();
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["function", "struct"]);
    });

    it("возвращает .java-спеку со Spring Boot роутами", () => {
      const spec = getRegexSignalSpec(file("src/main/java/App.java"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Spring Boot");
      expect(spec.apiSurfacePatterns.some((pattern) => pattern.source.includes("Mapping"))).toBe(
        true,
      );
    });

    it("возвращает .php-спеку с Laravel-роутами", () => {
      const spec = getRegexSignalSpec(file("routes/web.php"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Laravel");
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["class", "function"]);
    });

    it("возвращает .py-спеку с двумя FastAPI-роут-паттернами и extraFrameworkTokens", () => {
      const spec = getRegexSignalSpec(file("src/app.py"));

      expect(spec.routePatterns).toHaveLength(2);
      for (const route of spec.routePatterns ?? []) {
        expect(route.framework).toBe("FastAPI");
      }
      expect(typeof spec.extraFrameworkTokens).toBe("function");
      expect(spec.apiSurfacePatterns).toHaveLength(3);
    });

    it("возвращает .rb-спеку с Ruby Router роутами", () => {
      const spec = getRegexSignalSpec(file("app/controllers/x.rb"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Ruby Router");
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual([
        "class",
        "module",
        "function",
      ]);
    });

    it("возвращает .rs-спеку с Axum-роутами и trait/struct символами", () => {
      const spec = getRegexSignalSpec(file("src/main.rs"));

      expect(spec.routePatterns?.[0]?.framework).toBe("Axum");
      expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual([
        "function",
        "struct",
        "trait",
      ]);
    });

    it("возвращает .scala- и .swift-спеки без routePatterns", () => {
      expect(getRegexSignalSpec(file("Main.scala")).routePatterns).toBeUndefined();
      expect(getRegexSignalSpec(file("Main.swift")).routePatterns).toBeUndefined();
    });
  });

  describe("алиасы расширений", () => {
    it("маппит C-семейство на c-family-спеку", () => {
      for (const ext of [".cc", ".cpp", ".h", ".hpp"]) {
        const spec = getRegexSignalSpec(file(`src/main${ext}`));
        expect(spec.importPatterns[0]!.source).toBe(/^\s*#include\s+"([^"]+)"/u.source);
        expect(spec.symbolPatterns.map((symbol) => symbol.kind)).toEqual(["function"]);
      }
    });

    it(".c не в алиасах → DEFAULT-спека (факт)", () => {
      const spec = getRegexSignalSpec(file("src/main.c"));
      expect(spec.routePatterns).toBeUndefined();
      expect(spec.apiSurfacePatterns).toEqual([]);
    });

    it("маппит .kt/.kts на .java-спеку", () => {
      for (const ext of [".kt", ".kts"]) {
        const spec = getRegexSignalSpec(file(`src/App${ext}`));
        expect(spec.routePatterns?.[0]?.framework).toBe("Spring Boot");
      }
    });

    it("маппит .bsl/.os на 1c-спеку, а .ex/.exs на elixir-спеку", () => {
      const oneCSpec = getRegexSignalSpec(file("src/module.bsl"));
      expect(oneCSpec.extraFrameworkTokens?.({ content: "", path: "src/module.os" })).toEqual([
        "1C:Enterprise",
      ]);

      const elixirSpec = getRegexSignalSpec(file("lib/app.ex"));
      expect(elixirSpec.routePatterns?.[0]?.framework).toBe("Phoenix");
    });
  });

  describe("неизвестное расширение → DEFAULT-спека", () => {
    it("для .xyz-расширения возвращает дефолтный набор", () => {
      const spec = getRegexSignalSpec(file("src/unknown.xyz"));

      expect(spec.apiSurfacePatterns).toEqual([]);
      expect(spec.exportPatterns).toHaveLength(2);
      expect(spec.importPatterns).toHaveLength(4);
      expect(spec.routePatterns).toBeUndefined();
      expect(spec.symbolPatterns).toHaveLength(3);
      expect(spec.entrypointHint(file("src/unknown.xyz"))).toBe(false);
    });

    it("для пути без расширения тоже возвращает DEFAULT", () => {
      const spec = getRegexSignalSpec(file("Makefile"));

      expect(spec.apiSurfacePatterns).toEqual([]);
      expect(spec.routePatterns).toBeUndefined();
    });

    it("для uppercase-расширения возвращает DEFAULT (регистрочувствительный lookup)", () => {
      const spec = getRegexSignalSpec(file("src/App.TS"));

      expect(spec.apiSurfacePatterns).toEqual([]);
      expect(spec.routePatterns).toBeUndefined();
    });
  });

  describe("regex-паттерны из спек против реальных строк", () => {
    it(".go Router-роут: группа method и path", () => {
      const spec = getRegexSignalSpec(file("main.go"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      expect(pattern).toBeDefined();

      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('router.GET("/healthz", handler)');
      expect(match?.[1]).toBe("GET");
      expect(match?.[2]).toBe("/healthz");
    });

    it(".py FastAPI роуты: @app.get и @router.post", () => {
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

    it(".cs MapGet: группа method и path", () => {
      const spec = getRegexSignalSpec(file("Program.cs"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('app.MapGet("/api/items", handler)');

      expect(match?.[1]).toBe("Get");
      expect(match?.[2]).toBe("/api/items");
    });

    it('.rs Axum-роут: #[get("/x")]', () => {
      const spec = getRegexSignalSpec(file("main.rs"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('#[get("/widgets")]');

      expect(match?.[1]).toBe("get");
      expect(match?.[2]).toBe("/widgets");
    });

    it('.php Laravel-роут: Route::get(" /users")', () => {
      const spec = getRegexSignalSpec(file("web.php"));
      const pattern = spec.routePatterns?.[0]?.pattern;
      const fresh = new RegExp(pattern!.source, pattern!.flags);
      const match = fresh.exec('Route::get("/users", "UserController@index")');

      expect(match?.[1]).toBe("get");
      expect(match?.[2]).toBe("/users");
    });

    it("DEFAULT: export-строки и необворачивающие import", () => {
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
      // кавычковые side-effect импорты дефолтной спекой не собираются — `"` не в [\w./-]
      expect(importPattern.exec('import "./styles.css";')).toBeNull();
    });
  });

  describe("entrypointHint", () => {
    it(".cs: static void Main и WebApplication.CreateBuilder", () => {
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

    it(".go: пакет main + func main", () => {
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

    it(".swift: @main; .rb: run/start в basename или config.ru", () => {
      const swiftSpec = getRegexSignalSpec(file("main.swift"));
      expect(swiftSpec.entrypointHint(file("main.swift", "@main struct App {}"))).toBe(true);
      expect(swiftSpec.entrypointHint(file("main.swift", "import UIKit"))).toBe(false);

      const rubyspec = getRegexSignalSpec(file("bin/run.rb"));
      expect(rubyspec.entrypointHint(file("bin/run.rb", "require 'app'"))).toBe(true);
      expect(rubyspec.entrypointHint(file("config.ru", ""))).toBe(true);
      expect(rubyspec.entrypointHint(file("app.rb", "require 'app'"))).toBe(false);
    });

    it(".php: index.php по имени файла", () => {
      const spec = getRegexSignalSpec(file("public/index.php"));

      expect(spec.entrypointHint(file("public/index.php", "<?php echo 1;"))).toBe(true);
      expect(spec.entrypointHint(file("public/router.php", "<?php echo 1;"))).toBe(false);
    });

    it("1c: модули приложения в пути", () => {
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
    it(".py: собирает имена фреймворков из содержимого", () => {
      const spec = getRegexSignalSpec(file("app.py"));

      const tokens = spec.extraFrameworkTokens?.(
        file("app.py", "app = FastAPI()\nrouter = APIRouter()\nfrom flask import Flask"),
      );

      expect(tokens).toEqual(["FastAPI", "APIRouter", "Flask"]);
    });

    it(".py: без фреймворк-токенов возвращает пустой список", () => {
      const spec = getRegexSignalSpec(file("app.py"));

      expect(spec.extraFrameworkTokens?.(file("app.py", "import os"))).toEqual([]);
    });

    it("1c: всегда возвращает токен 1C:Enterprise", () => {
      const spec = getRegexSignalSpec(file("src/module.bsl"));

      expect(spec.extraFrameworkTokens?.(file("src/module.bsl", ""))).toEqual(["1C:Enterprise"]);
    });
  });
});
