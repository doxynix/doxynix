import type { Repo } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildFinalMetrics } from "../../logic/analysis-scoring";
import { calculateCodeMetrics } from "../metrics/code-metrics";
import { parseRepoMetrics, RepoMetricsSchema } from "./metrics.schemas";
import type { RepoMetrics } from "./metrics.types";

describe("RepoMetricsSchema against real engine output", () => {
  it("accepts the metrics the engine produces for a real repository", async () => {
    const metrics = await calculateCodeMetrics([
      {
        content:
          'import express from "express";\nexport const app = express();\napp.get("/health", (_req, res) => res.json({ ok: true }));\n',
        path: "src/server/app.ts",
      },
      {
        content: "export const PORT = 3000;\n",
        path: "src/config.ts",
      },
      {
        content: "# Demo\n\nA demo repository.\n",
        path: "README.md",
      },
    ]);

    const parsed = RepoMetricsSchema.safeParse(metrics);

    if (!parsed.success) {
      throw new Error(
        `Schema rejected real engine output: ${JSON.stringify(parsed.error.issues.slice(0, 8))}`,
      );
    }

    expect(parsed.data.hotspotFiles).toEqual(metrics.hotspotFiles);
    expect(parsed.data.securityScore).toBe(metrics.securityScore);
  }, 60_000);

  it("returns a usable payload through parseRepoMetrics for engine output", async () => {
    const metrics = await calculateCodeMetrics([
      { content: "export const a = 1;\n", path: "src/a.ts" },
    ]);

    const parsed = parseRepoMetrics(metrics);

    expect(parsed).not.toBeNull();
    expect(parsed?.totalSizeKb).toBe(metrics.totalSizeKb);
  }, 60_000);

  it("accepts the buildFinalMetrics overlay that gets persisted", async () => {
    const hardMetrics = await calculateCodeMetrics([
      {
        content: 'import express from "express";\nexport const app = express();\n',
        path: "src/app.ts",
      },
      { content: "# Demo\n", path: "README.md" },
    ]);

    const finalMetrics: RepoMetrics = buildFinalMetrics({
      busFactor: 3,
      factCount: 12,
      finalHealthScore: 81,
      findingCount: 4,
      hardMetrics,
      onboardingScore: 66,
      repo: { defaultBranch: "main", pushedAt: new Date("2026-01-01T00:00:00Z") } as Repo,
      teamRoles: [{ login: "ivan", role: "author", share: 1 }],
    });

    const parsed = RepoMetricsSchema.safeParse(finalMetrics);

    if (!parsed.success) {
      throw new Error(
        `Schema rejected buildFinalMetrics output: ${JSON.stringify(parsed.error.issues.slice(0, 8))}`,
      );
    }

    expect(parseRepoMetrics(finalMetrics)).not.toBeNull();
  }, 60_000);
});

describe("parseRepoMetrics tolerance", () => {
  const base = {
    analysisCoverage: {
      heuristicFiles: 1,
      languagesByMode: { heuristic: ["ts"], treeSitter: ["ts"], typeScriptAst: ["ts"] },
      parserCoveragePercent: 100,
      totalFiles: 1,
      treeSitterFiles: 1,
      typeScriptAstFiles: 1,
    },
    apiSurface: 0,
    busFactor: 1,
    complexityScore: 10,
    configFiles: 0,
    configInventory: [],
    dependencyCycles: [],
    dependencyHotspots: [],
    docDensity: 0,
    duplicationReport: { clones: [], duplicationPercentage: 0, totalDuplicatedLines: 0 },
    entrypoints: [],
    factCount: 0,
    fileCount: 1,
    findingCount: 0,
    healthScore: 80,
    hotspotFiles: [],
    languages: [{ color: "#fff", lines: 1, name: "TypeScript" }],
    maintenanceStatus: "active",
    modularityIndex: 0.5,
    mostComplexFiles: [],
    onboardingScore: 70,
    orphanModules: [],
    publicExports: 0,
    securityFindings: [],
    securityScanStatus: "ok",
    securityScore: 90,
    teamRoles: [],
    techDebtScore: 20,
    techStack: ["TypeScript"],
    totalLoc: 1,
    totalSizeKb: 1,
  };

  it("parses a minimal complete payload", () => {
    expect(parseRepoMetrics(base)).not.toBeNull();
  });

  it("keeps unknown engine fields instead of stripping them", () => {
    const parsed = parseRepoMetrics({ ...base, someFutureEngineField: { nested: true } });

    expect(parsed).not.toBeNull();
    expect(parsed?.someFutureEngineField).toEqual({ nested: true });
  });

  it("tolerates optional fields being absent", () => {
    expect(parseRepoMetrics(base)).not.toBeNull();
  });

  it("returns null instead of throwing on a non-object", () => {
    expect(parseRepoMetrics(null)).toBeNull();
    expect(parseRepoMetrics("nope")).toBeNull();
    expect(parseRepoMetrics(42)).toBeNull();
  });

  it("returns null when a validated field has the wrong type", () => {
    expect(parseRepoMetrics({ ...base, healthScore: "eighty" })).toBeNull();
    expect(parseRepoMetrics({ ...base, hotspotFiles: "src/a.ts" })).toBeNull();
    expect(parseRepoMetrics({ ...base, maintenanceStatus: "unknown" })).toBeNull();
    expect(parseRepoMetrics({ ...base, teamRoles: [{ login: "a" }] })).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    const { securityScore: _dropped, ...withoutSecurityScore } = base;
    expect(parseRepoMetrics(withoutSecurityScore)).toBeNull();
  });
});
