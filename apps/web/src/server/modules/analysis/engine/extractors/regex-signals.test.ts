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
  describe("TypeScript-файл (DEFAULT-спека)", () => {
    const signals = collectRegexSignals(file("src/app.ts", TS_FIXTURE));

    it("собирает bare-импорты (кавычковые side-effect не матчатся дефолтной спекой)", () => {
      expect(signals.imports).toEqual(["lodash"]);
    });

    it("считает экспорты по строкам export/function/class/interface и не считает комментарии", () => {
      // export function, export const, interface User, class Service, function helper
      expect(signals.exports).toBe(5);
    });

    it("находит символы function/class/interface с экспортной достоверностью", () => {
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

    it("не даёт apiSurface и роутов для дефолтной спеки", () => {
      expect(signals.apiSurface).toBe(0);
      expect(signals.routes).toEqual([]);
    });

    it("не считает import.meta.env кодом (entrypointHint=false) и сохраняет базовые поля", () => {
      expect(signals.entrypointHint).toBe(false);
      expect(signals.analysisMode).toBe("heuristic");
      expect(signals.confidence).toBe(60);
      expect(signals.source).toBe("extraction");
      expect(signals.complexityMetrics).toEqual({ complexity: 0, maxNesting: 0 });
      expect(signals.path).toBe("src/app.ts");
      expect(signals.frameworkHints).toBeDefined();
    });

    it("подсвечивает строки символов (смещение на 1 из-за ^ + \\s*)", () => {
      const helper = (signals.symbols ?? []).find((symbol) => symbol.name === "helper");

      expect(helper?.line).toBe(17);
    });
  });

  describe("Python FastAPI-файл", () => {
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

    it("собирает импорты в порядке паттернов: import-строки до from-строк", () => {
      expect(signals.imports).toEqual(["os", "fastapi"]);
    });

    it("считает exports: def и class", () => {
      expect(signals.exports).toBe(2);
    });

    it("считает apiSurface только от @app/декоратор-роутов", () => {
      expect(signals.apiSurface).toBe(1);
    });

    it("извлекает FastAPI-роут с методом, путём и строкой", () => {
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

    it("извлекает символы function/class", () => {
      const names = (signals.symbols ?? []).map((symbol) => symbol.name);
      expect(names).toEqual(["list_items", "Item"]);
      expect((signals.symbols ?? [])[0]?.kind).toBe("function");
      expect((signals.symbols ?? [])[1]?.kind).toBe("class");
    });

    it("распознаёт входную точку __main__", () => {
      expect(signals.entrypointHint).toBe(true);
    });

    it("собирает фреймворк-факт FastAPI из токенов импорта", () => {
      expect(signals.frameworkHints).toContainEqual(
        expect.objectContaining({ category: "framework", confidence: 88, name: "FastAPI" }),
      );
    });
  });

  describe("Go-файл", () => {
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

    it("собирает импорт из блочного require-формата (standalone-строка)", () => {
      expect(signals.imports).toEqual(["log"]);
    });

    it("считает apiSurface с учётом двойного матчинга router.GET (фактическое поведение)", () => {
      // GET(...) и router.GET(...) оба матчатся на каждый роут: 2 роута * 2 паттерна = 4
      expect(signals.apiSurface).toBe(4);
    });

    it("считает exports только для экспортируемых (uppercase) функций — main не экспорт", () => {
      // `main` начинается со строчной буквы → не матчит [A-Z]\w* (Go-правило экспорта)
      expect(signals.exports).toBe(0);
    });

    it("не находит main как символ (строчная буква — не экспорт)", () => {
      expect(signals.symbols ?? []).toEqual([]);
    });

    it("извлекает 2 Gin-роута", () => {
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

    it("распознаёт пакет main + func main как входную точку", () => {
      expect(signals.entrypointHint).toBe(true);
    });
  });

  describe("Ruby-файл", () => {
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

    it("собирает require-импорты", () => {
      expect(signals.imports).toEqual(["json"]);
    });

    it("считает exports: class и def", () => {
      expect(signals.exports).toBe(2);
    });

    it("считает apiSurface и извлекает Ruby Router роут", () => {
      expect(signals.apiSurface).toBe(1);
      expect(signals.routes).toHaveLength(1);
      expect(signals.routes?.[0]).toMatchObject({
        framework: "Ruby Router",
        line: 7,
        method: "GET",
        path: "/users",
      });
    });

    it("находит class и method-функции", () => {
      expect((signals.symbols ?? []).map((symbol) => symbol.name)).toEqual([
        "UsersController",
        "index",
      ]);
    });
  });

  describe("крайние случаи", () => {
    it("пустой файл → нулевые счётчики без throw", () => {
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

    it("не падает на разных расширениях и путях без расширения", () => {
      for (const path of ["README.md", "src/index.tsx", "index.html", "data.txt", "Makefile"]) {
        expect(() => collectRegexSignals(file(path, "anything here"))).not.toThrow();
      }
    });

    it("не считает закомментированный код", () => {
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
