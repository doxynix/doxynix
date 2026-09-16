import { describe, expect, it } from "vitest";

import type { FrameworkFact } from "./discovery.types";
import {
  collectFrameworkFactsFromTokens,
  selectRepositoryFrameworkFacts,
} from "./framework-catalog";

function makeFact(overrides: Partial<FrameworkFact>): FrameworkFact {
  return { category: "framework", confidence: 70, name: "Fact", sources: [], ...overrides };
}

describe("collectFrameworkFactsFromTokens", () => {
  it("collects framework facts with unique sources and sorts by confidence", () => {
    const facts = collectFrameworkFactsFromTokens(["hono", "react", "hono"], "src/app.ts", 72);

    expect(facts).toEqual([
      { category: "framework", confidence: 72, name: "Hono", sources: ["src/app.ts"] },
      { category: "ui", confidence: 72, name: "React", sources: ["src/app.ts"] },
    ]);
  });

  it("matches aliases containing slashes via substring includes", () => {
    const facts = collectFrameworkFactsFromTokens(["@hono/node-server"], "src/app.ts", 72);

    expect(facts).toEqual([
      { category: "framework", confidence: 72, name: "Hono", sources: ["src/app.ts"] },
    ]);
  });

  it("does not match an alias when it is part of another token", () => {
    expect(collectFrameworkFactsFromTokens(["honored"], "src/app.ts", 72)).toEqual([]);
    expect(collectFrameworkFactsFromTokens(["monopoly"], "src/app.ts", 72)).toEqual([]);
  });

  it("matches aliases at token boundaries", () => {
    expect(
      collectFrameworkFactsFromTokens(["react-hono"], "src/app.ts", 72).map((fact) => fact.name),
    ).toEqual(["Hono", "React"]);
  });

  it("is case-insensitive for tokens and aliases", () => {
    const facts = collectFrameworkFactsFromTokens(["HONO", "REACT"], "src/app.ts", 72);

    expect(facts.map((fact) => fact.name).sort()).toEqual(["Hono", "React"]);
  });

  it("reuses a single source across duplicate aliases of the same framework", () => {
    const facts = collectFrameworkFactsFromTokens(["hono", "@hono/node-server"], "src/app.ts", 72);

    expect(facts).toEqual([
      { category: "framework", confidence: 72, name: "Hono", sources: ["src/app.ts"] },
    ]);
  });
});

describe("selectRepositoryFrameworkFacts", () => {
  it("keeps facts with multiple core sources and drops manifest-only facts", () => {
    const facts = [
      makeFact({
        confidence: 72,
        name: "Hono",
        sources: ["src/app.ts", "src/api/trpc.ts"],
      }),
      makeFact({ category: "ui", confidence: 88, name: "React", sources: ["package.json"] }),
    ];

    expect(selectRepositoryFrameworkFacts(facts)).toEqual([
      {
        category: "framework",
        confidence: 72,
        name: "Hono",
        sources: ["src/app.ts", "src/api/trpc.ts"],
      },
    ]);
  });

  it("keeps a single core source for api and framework categories", () => {
    const facts = [
      makeFact({ category: "api", confidence: 92, name: "OpenAI SDK", sources: ["src/app.ts"] }),
      makeFact({ category: "ui", confidence: 88, name: "React", sources: ["package.json"] }),
    ];

    expect(selectRepositoryFrameworkFacts(facts).map((fact) => fact.name)).toEqual(["OpenAI SDK"]);
  });

  it("merges duplicate names into max confidence with unique sources", () => {
    const facts = [
      makeFact({ confidence: 72, name: "Hono", sources: ["src/app.ts"] }),
      makeFact({ confidence: 95, name: "Hono", sources: ["src/api/trpc.ts"] }),
    ];

    expect(selectRepositoryFrameworkFacts(facts)).toEqual([
      {
        category: "framework",
        confidence: 95,
        name: "Hono",
        sources: ["src/app.ts", "src/api/trpc.ts"],
      },
    ]);
  });

  it("falls back to all facts when every fact is manifest-only", () => {
    const facts = [
      makeFact({ category: "ui", confidence: 88, name: "React", sources: ["package.json"] }),
      makeFact({ category: "ui", confidence: 70, name: "Vue", sources: ["docs/guide.md"] }),
    ];

    expect(
      selectRepositoryFrameworkFacts(facts)
        .map((fact) => fact.name)
        .sort(),
    ).toEqual(["React", "Vue"]);
  });

  it("filters manifest-only facts out of the fallback when others exist", () => {
    const facts = [
      makeFact({ category: "ui", confidence: 88, name: "React", sources: ["package.json"] }),
      makeFact({
        category: "framework",
        confidence: 70,
        name: "ElysiaJS",
        sources: ["benchmarks/bench.ts"],
      }),
    ];

    expect(selectRepositoryFrameworkFacts(facts).map((fact) => fact.name)).toEqual(["ElysiaJS"]);
  });
});
