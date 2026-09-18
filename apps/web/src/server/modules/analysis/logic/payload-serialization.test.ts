import { describe, expect, it } from "vitest";

import type { RepoMetrics } from "../engine/core/metrics.types";
import {
  buildWriterSectionPayloads,
  serializeAllowedPaths,
  toPromptJson,
} from "./payload-serialization";

type DocumentationInputSnapshot = NonNullable<RepoMetrics["documentationInput"]>;

const moduleSummary = (path: string) => ({
  apiSurface: 1,
  categories: ["runtime-source"],
  exports: 2,
  parseTier: "heuristic",
  path,
});

const documentationInput = {
  sections: {
    api_reference: {
      audience: "mixed",
      body: {
        entrypoints: [],
        frameworkFacts: [],
        publicSurfacePaths: ["/api/items"],
        routeInventory: {
          estimatedOperations: 2,
          frameworks: ["Hono"],
          httpRoutes: [{ method: "GET", path: "/items", sourcePath: "src/routes.ts" }],
          rpcProcedures: 0,
          source: "extracted",
          sourceFiles: ["src/routes.ts"],
        },
        sourceOfTruth: "extracted",
      },
      confidence: 80,
      evidencePaths: ["src/routes.ts"],
      section: "api_reference",
      summary: [],
      title: "API",
      unknowns: [],
    },
    architecture: {
      audience: "tech-lead",
      body: {
        dependencyCycles: [],
        dependencyHotspots: [],
        graphReliability: {
          edges: [
            {
              fromPath: "src/app.ts",
              kind: "internal",
              resolved: true,
              specifier: "./routes",
              toPath: "src/routes.ts",
            },
          ],
          resolvedEdges: 1,
          unresolvedImportSpecifiers: 0,
          unresolvedSamples: [],
        },
        modules: Array.from({ length: 10 }, (_, i) => moduleSummary(`src/module-${i}.ts`)),
        orphanModules: [],
        primaryEntrypoints: ["src/app.ts"],
      },
      confidence: 75,
      evidencePaths: Array.from({ length: 15 }, (_, i) => `src/evidence-${i}.ts`),
      section: "architecture",
      summary: ["Modules"],
      title: "Architecture",
      unknowns: ["unknown"],
    },
    onboarding: {
      audience: "mixed",
      body: {
        apiPaths: ["/api/items"],
        configPaths: ["tsconfig.json"],
        firstLookPaths: ["src/app.ts"],
        newcomerSteps: ["Run bun dev"],
        riskPaths: [],
      },
      confidence: 70,
      evidencePaths: Array.from({ length: 20 }, (_, i) => `src/onb-${i}.ts`),
      section: "onboarding",
      summary: [],
      title: "Onboarding",
      unknowns: [],
    },
    overview: {
      audience: "newcomer",
      body: {
        configFiles: ["tsconfig.json"],
        primaryEntrypoints: ["src/app.ts"],
        primaryModules: ["src/app.ts"],
        repositoryKind: "service",
        stackProfile: ["Hono", "PostgreSQL"],
      },
      confidence: 85,
      evidencePaths: [],
      section: "overview",
      summary: ["Overview"],
      title: "Overview",
      unknowns: [],
    },
  },
} as unknown as DocumentationInputSnapshot;

describe("toPromptJson", () => {
  it("serializes non-object values as-is", () => {
    expect(toPromptJson(undefined)).toBe("{}");
    expect(toPromptJson(null)).toBe("{}");
    expect(toPromptJson(42)).toBe("42");
    expect(toPromptJson("text")).toBe('"text"');
    expect(toPromptJson(true)).toBe("true");
  });

  it("drops empty arrays and objects at any level", () => {
    expect(toPromptJson({})).toBe("{}");
    expect(toPromptJson({ a: [] })).toBe("{}");
    expect(toPromptJson({ a: {} })).toBe("{}");
    expect(toPromptJson({ outer: { inner: [] } })).toBe("{}");
    expect(toPromptJson({ outer: { inner: 1 } })).toBe('{"outer":{"inner":1}}');
  });

  it("keeps primitives and non-empty arrays", () => {
    const parsed = JSON.parse(toPromptJson({ name: "web", score: 42, tags: ["a", "b"] }));

    expect(parsed).toEqual({ name: "web", score: 42, tags: ["a", "b"] });
  });

  it("removes empty objects from arrays", () => {
    const parsed = JSON.parse(toPromptJson({ list: [{ a: 1 }, {}] }));

    expect(parsed.list).toEqual([{ a: 1 }]);
  });

  it("for a graphReliability-like object drops edges and trims unresolvedSamples to 8", () => {
    const payload = {
      graphReliability: {
        edges: [{ fromPath: "a", kind: "internal", resolved: true, specifier: "./b" }],
        extra: { keep: true },
        resolvedEdges: 10,
        unresolvedImportSpecifiers: 3,
        unresolvedSamples: Array.from({ length: 20 }, (_, i) => ({
          fromPath: `f${i}`,
          specifier: `s${i}`,
        })),
      },
    };

    const parsed = JSON.parse(toPromptJson(payload));

    expect(parsed.graphReliability.edges).toBeUndefined();
    expect(parsed.graphReliability.unresolvedSamples).toHaveLength(8);
    expect(parsed.graphReliability.resolvedEdges).toBe(10);
    expect(parsed.graphReliability.extra).toEqual({ keep: true });
  });

  it("for a non-graphReliability object keeps edges and unresolvedSamples intact", () => {
    const parsed = JSON.parse(
      toPromptJson({ edges: [{ id: 1 }], unresolvedSamples: [{ x: 1 }, { x: 2 }] }),
    );

    expect(parsed.edges).toHaveLength(1);
    expect(parsed.unresolvedSamples).toHaveLength(2);
  });
});

describe("serializeAllowedPaths", () => {
  it("sorts paths by localeCompare", () => {
    expect(JSON.parse(serializeAllowedPaths(["z.ts", "a.ts", "m.ts"]))).toEqual([
      "a.ts",
      "m.ts",
      "z.ts",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = ["z.ts", "a.ts"];

    serializeAllowedPaths(input);

    expect(input).toEqual(["z.ts", "a.ts"]);
  });

  it("returns valid JSON for an empty array", () => {
    expect(JSON.parse(serializeAllowedPaths([]))).toEqual([]);
  });
});

describe("buildWriterSectionPayloads", () => {
  const payloads = buildWriterSectionPayloads(documentationInput);

  it("returns 5 entries with sections per DOC_SECTION_DEPENDENCIES", () => {
    expect(Object.keys(payloads)).toEqual([
      "api",
      "architecture",
      "changelog",
      "contributing",
      "readme",
    ]);
    expect(payloads.api.sections).toEqual(["api_reference"]);
    expect(payloads.architecture.sections).toEqual(["architecture", "risks", "onboarding"]);
    expect(payloads.changelog.sections).toEqual([]);
    expect(payloads.contributing.sections).toEqual(["overview", "onboarding"]);
    expect(payloads.readme.sections).toEqual(["overview", "architecture"]);
  });

  it("changelog always has an empty payload", () => {
    expect(payloads.changelog.payload).toBe("");
  });

  it("api.payload serializes the api_reference section", () => {
    const parsed = JSON.parse(payloads.api.payload);

    expect(parsed.body.publicSurfacePaths).toEqual(["/api/items"]);
    expect(parsed.body.routeInventory.frameworks).toEqual(["Hono"]);
    expect(parsed.section).toBe("api_reference");
  });

  it("readme.payload trims modules to 8 and evidencePaths to 12/16, keeps primaryEntrypoints", () => {
    const parsed = JSON.parse(payloads.readme.payload);

    expect(parsed.architecture.body.modules).toHaveLength(8);
    expect(parsed.architecture.body.primaryEntrypoints).toEqual(["src/app.ts"]);
    expect(parsed.architecture.evidencePaths).toHaveLength(12);
    expect(parsed.onboarding.evidencePaths).toHaveLength(16);
  });

  it("readme.payload drops graph edges via compactPromptPayload", () => {
    const parsed = JSON.parse(payloads.readme.payload);

    expect(parsed.architecture.body.graphReliability.edges).toBeUndefined();
    expect(parsed.architecture.body.graphReliability.resolvedEdges).toBe(1);
  });

  it("contributing.payload merges onboarding and overview", () => {
    const parsed = JSON.parse(payloads.contributing.payload);

    expect(parsed.onboarding.body.apiPaths).toEqual(["/api/items"]);
    expect(parsed.overview.body.repositoryKind).toBe("service");
    expect(parsed.overview.body.primaryEntrypoints).toEqual(["src/app.ts"]);
  });
});
