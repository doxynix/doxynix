import { describe, expect, it } from "vitest";

import type { FileSignals, TechFact } from "./discovery.types";
import { FactCollector } from "./fact-collector";

function makeSignals(path: string, overrides: Partial<FileSignals> = {}): FileSignals {
  return {
    analysisMode: "heuristic",
    apiSurface: 0,
    complexityMetrics: { complexity: 0, maxNesting: 0 },
    confidence: 60,
    entrypointHint: false,
    exports: 0,
    imports: [],
    path,
    source: "extraction",
    ...overrides,
  };
}

function collectFiles(
  files: Array<{ content: string; path: string }>,
  signalsByFile: Array<[string, FileSignals]> = [],
) {
  return FactCollector.collect(files, undefined, new Map(signalsByFile));
}

function findFact(facts: TechFact[], name: string): TechFact | undefined {
  return facts.find((fact) => fact.name === name);
}

describe("FactCollector.collect", () => {
  it("returns an empty list for no input", () => {
    expect(FactCollector.collect([])).toEqual([]);
  });

  it("parses package.json dependencies into framework facts", () => {
    const facts = collectFiles([
      {
        content: JSON.stringify({
          dependencies: { hono: "^4.0.0", react: "^19.0.0" },
          devDependencies: {},
          name: "example",
          scripts: { build: "tsc" },
        }),
        path: "package.json",
      },
    ]);

    expect(findFact(facts, "Hono")).toEqual({
      category: "Framework",
      confidence: 95,
      name: "Hono",
    });
    expect(findFact(facts, "React")).toEqual({
      category: "UI/Styling",
      confidence: 95,
      name: "React",
    });
  });

  it("parses pom.xml artifact ids and group ids into framework facts", () => {
    const facts = collectFiles([
      {
        content:
          "<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>",
        path: "pom.xml",
      },
    ]);

    expect(findFact(facts, "Spring Boot")).toEqual({
      category: "Framework",
      confidence: 92,
      name: "Spring Boot",
    });
  });

  it("parses csproj package references into framework facts", () => {
    const facts = collectFiles([
      {
        content:
          '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Hono" Version="4.0.0" /></ItemGroup></Project>',
        path: "src/App.csproj",
      },
    ]);

    expect(findFact(facts, "Hono")).toEqual({
      category: "Framework",
      confidence: 92,
      name: "Hono",
    });
  });

  it("parses requirements.txt entries into framework facts", () => {
    const facts = collectFiles([
      { content: "flask\nfastapi\nrequests\n", path: "requirements.txt" },
    ]);

    expect(findFact(facts, "Flask")?.confidence).toBe(88);
    expect(findFact(facts, "FastAPI")?.confidence).toBe(88);
  });

  it("parses go.mod dependencies into framework facts", () => {
    const facts = collectFiles([
      {
        content:
          "module example.com/app\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgithub.com/labstack/echo v4.0.0\n)\n",
        path: "go.mod",
      },
    ]);

    expect(findFact(facts, "Gin")?.confidence).toBe(88);
    expect(findFact(facts, "Echo")?.confidence).toBe(88);
  });

  it("parses cargo.toml dependencies into framework facts", () => {
    const facts = collectFiles([
      {
        content: '[dependencies]\nactix-web = "4.0"\ntokio = { version = "1" }\n',
        path: "cargo.toml",
      },
    ]);

    expect(findFact(facts, "Actix Web")).toEqual({
      category: "Framework",
      confidence: 88,
      name: "Actix Web",
    });
  });

  it("parses composer.json require sections into framework facts", () => {
    const facts = collectFiles([
      {
        content: '{"require":{"laravel/framework":"^10.0"},"require-dev":{"phpunit/phpunit":"^9"}}',
        path: "composer.json",
      },
    ]);

    expect(findFact(facts, "Laravel")).toEqual({
      category: "Framework",
      confidence: 94,
      name: "Laravel",
    });
  });

  it("derives facts from signals: framework hints and imports", () => {
    const facts = collectFiles(
      [{ content: "", path: "src/app.ts" }],
      [
        [
          "src/app.ts",
          makeSignals("src/app.ts", {
            frameworkHints: [
              { category: "framework", confidence: 80, name: "Fastify", sources: ["src/app.ts"] },
            ],
            imports: ["hono"],
          }),
        ],
      ],
    );

    expect(findFact(facts, "Fastify")).toEqual({
      category: "Framework",
      confidence: 80,
      name: "Fastify",
    });
    expect(findFact(facts, "Hono")).toEqual({
      category: "Framework",
      confidence: 72,
      name: "Hono",
    });
  });

  it("detects policy path facts for CI, docker, and terraform files", () => {
    const facts = collectFiles([
      { content: "", path: "repo/.github/workflows/ci.yml" },
      { content: "", path: "Dockerfile" },
      { content: "", path: "infra/main.tf" },
    ]);

    expect(findFact(facts, "GitHub Actions")).toEqual({
      category: "CI/CD",
      confidence: 100,
      name: "GitHub Actions",
    });
    expect(findFact(facts, "Docker")).toEqual({
      category: "Infrastructure",
      confidence: 100,
      name: "Docker",
    });
    expect(findFact(facts, "Terraform")).toEqual({
      category: "Infrastructure",
      confidence: 100,
      name: "Terraform",
    });
  });

  it("adds an OpenAPI fact when the route inventory source is openapi", () => {
    const facts = FactCollector.collect([], {
      configs: [],
      frameworkFacts: [],
      routeInventory: {
        estimatedOperations: 0,
        frameworks: [],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "openapi",
        sourceFiles: ["openapi.json"],
      },
    });

    expect(findFact(facts, "OpenAPI")).toEqual({
      category: "Framework",
      confidence: 92,
      name: "OpenAPI",
    });
  });

  it("detects 1C:Enterprise files by path", () => {
    const facts = collectFiles([{ content: "", path: "src/catalogs/products.os" }]);

    expect(findFact(facts, "1C:Enterprise")).toEqual({
      category: "Language",
      confidence: 95,
      name: "1C:Enterprise",
    });
  });

  it("returns facts sorted by confidence descending", () => {
    const facts = collectFiles([
      {
        content: JSON.stringify({
          dependencies: { hono: "^4.0.0", react: "^19.0.0" },
          name: "example",
          scripts: {},
        }),
        path: "package.json",
      },
      { content: "", path: "Dockerfile" },
    ]);

    for (let index = 1; index < facts.length; index += 1) {
      const prev = facts[index - 1];
      const current = facts[index];
      if (prev == null || current == null) {
        continue;
      }
      expect(prev.confidence).toBeGreaterThanOrEqual(current.confidence);
    }
  });
});
