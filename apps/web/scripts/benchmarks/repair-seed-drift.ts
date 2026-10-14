/**
 * Repair a stress clone so the procedures the seed cannot satisfy can be exercised at all.
 *
 * Run against `dxnx_web_stress` only. It is a data repair, not a migration: nothing is dropped, and
 * the three targets are the places where the seed's output contradicts the app's own schemas.
 *
 * Usage:
 *   DATABASE_URL=…/dxnx_web_stress bun scripts/benchmarks/repair-seed-drift.ts
 */
import pg from "pg";

const { Client } = pg;

const BATCH = 5000;

/**
 * The subset of `RepoMetricsSchema` the structure map, node context and search actually read. The
 * seed's old five-key payload failed validation against all thirty-one required fields.
 */
const METRICS_FIXTURE = {
  analysisCoverage: {
    heuristicFiles: 240,
    languagesByMode: { heuristic: [], treeSitter: [], typeScriptAst: [] },
    parserCoveragePercent: 97,
    totalFiles: 240,
    treeSitterFiles: 240,
    typeScriptAstFiles: 240,
  },
  apiSurface: 14,
  busFactor: 3,
  complexityScore: 22,
  configFiles: 3,
  configInventory: ["config/database.yml", "config/app.yml", "docker-compose.yml"],
  dependencyCycles: [],
  dependencyHotspots: [
    { dependencies: 9, dependents: 4, path: "src/services/service.ts", score: 30 },
    { dependencies: 6, dependents: 2, path: "src/api/handler.ts", score: 24 },
  ],
  docDensity: 0.3,
  documentationInput: { readme: "# fixture", structure: [] },
  duplicationReport: { clones: [], duplicationPercentage: 2, totalDuplicatedLines: 20 },
  entrypointDetails: [{ kind: "module", path: "src/index.ts", symbol: "main" }],
  entrypoints: ["src/index.ts", "src/api/handler.ts", "src/services/service.ts"],
  factCount: 70,
  fileCount: 240,
  findingCount: 4,
  hotspotFiles: ["src/services/service.ts", "src/api/handler.ts"],
  languages: [{ color: "#3178c6", lines: 9000, name: "TypeScript" }],
  maintenanceStatus: "active",
  modularityIndex: 0.8,
  mostComplexFiles: ["src/services/service.ts"],
  onboardingScore: 84,
  openapiInventory: { operations: 16, specPath: "docs/openapi.yaml", version: "3.1.0" },
  orphanModules: [],
  publicExports: 60,
  securityFindings: [
    { message: "Hardcoded secret", path: "src/services/service.ts", severity: "error" },
  ],
  securityScanStatus: "ok",
  securityScore: 92,
  teamRoles: [{ login: "karen", role: "maintainer", share: 1 }],
  techDebtScore: 20,
  techStack: ["Next.js", "PostgreSQL"],
  totalLoc: 9000,
  totalSizeKb: 800,
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (url == null) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!/stress|test/i.test(url)) {
    console.error("refusing to run outside a stress or test database");
    process.exit(1);
  }

  const db = new Client({ connectionString: url });
  await db.connect();

  const repos = (process.env.BENCH_REPAIR_REPOS ?? "").split(",").filter(Boolean);
  if (repos.length === 0) {
    throw new Error("BENCH_REPAIR_REPOS is required: comma-separated repository ids");
  }

  // 1. `riskScore` is capped at 10 by `AdminReviewDetailSchema`, but the seed generated 0-100, so
  //    89% of rows failed the admin review detail's input parse before any query ran.
  const risk = await db.query(
    `
    UPDATE pull_request_analyses
       SET risk_score = LEAST(10, GREATEST(0, risk_score % 11))
     WHERE risk_score IS NOT NULL AND (risk_score < 0 OR risk_score > 10)
       AND repo_id = ANY($1::uuid[])
    RETURNING id
  `,
    [repos],
  );
  console.log(`  risk_score приведён к 0..10: ${risk.rowCount ?? 0} строк`);

  // 2. Analyses carry no structure, so `getStructureMap`, `searchWorkspace` and `getNodeContext`
  //    found nothing to build a tree from. Give every completed analysis a small, valid graph.
  const analyses = await db.query<{ id: string }>(
    `SELECT id FROM analyses
      WHERE status = 'DONE' AND repo_id = ANY($1::uuid[])
      ORDER BY created_at DESC`,
    [repos],
  );
  let graphed = 0;
  for (let i = 0; i < analyses.rows.length; i += BATCH) {
    const slice = analyses.rows.slice(i, i + BATCH);
    const res = await db.query(
      `UPDATE analyses a
          SET result_json = COALESCE(a.result_json, '{}'::jsonb) || $2::jsonb
        WHERE a.id = ANY($1::uuid[])`,
      [
        slice.map((r) => r.id),
        JSON.stringify({
          graph: {
            edges: [
              { from: "src/auth/service.ts", to: "src/users/repository.ts", weight: 0.8 },
              { from: "src/users/repository.ts", to: "src/db/client.ts", weight: 0.6 },
              { from: "src/api/handler.ts", to: "src/auth/service.ts", weight: 0.7 },
            ],
            nodes: [
              { id: "src/auth/service.ts", kind: "module", loc: 420 },
              { id: "src/users/repository.ts", kind: "module", loc: 260 },
              { id: "src/db/client.ts", kind: "module", loc: 180 },
              { id: "src/api/handler.ts", kind: "module", loc: 310 },
            ],
          },
          repository_facts: [{ id: "fact-1", statement: "Auth lives in src/auth/service.ts" }],
        }),
      ],
    );
    graphed += res.rowCount ?? 0;
  }
  console.log(`  граф и факты добавлены: ${graphed} анализов`);

  // 2b. `metrics_json` is what the structure map, node context and search all read, and the seed
  //     wrote five keys where `RepoMetricsSchema` requires thirty-one. `coerceAnalysisPayload`
  //     substitutes `EMPTY_REPO_METRICS` on a validation failure, so these analyses were readable
  //     but empty. Merged rather than replaced, so the keys the old generator did write survive.
  const metrics = await db.query(
    `
    UPDATE analyses
       SET metrics_json = COALESCE(metrics_json, '{}'::jsonb) || $2::jsonb
     WHERE repo_id = ANY($1::uuid[])
       AND COALESCE(metrics_json, '{}'::jsonb) ? 'entrypoints' IS NOT TRUE
    RETURNING id
  `,
    [repos, JSON.stringify(METRICS_FIXTURE)],
  );
  console.log(`  metrics_json дополнен: ${metrics.rowCount ?? 0} анализов`);

  // 3. The documentation procedures read `documents`, and the clone has none for the repositories
  //    the other procedures exercise. One of each doc type per analysis, so `getAvailableDocs`,
  //    `getDocumentContent` and `getWithGraphLinks` have something real to return.
  const docs = await db.query<{ analysisId: string; repoId: string }>(
    `
    SELECT a.id AS "analysisId", a.repo_id AS "repoId"
      FROM analyses a
     WHERE a.status = 'DONE'
       AND a.repo_id = ANY($1::uuid[])
       AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.analysis_id = a.id)
     ORDER BY a.created_at DESC
     LIMIT 2000
  `,
    [repos],
  );
  let inserted = 0;
  for (const row of docs.rows) {
    for (const type of ["README", "API", "CONTRIBUTING", "CHANGELOG", "ARCHITECTURE"]) {
      await db.query(
        `INSERT INTO documents (analysis_id, content, repo_id, type, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4::"DocType", $5, now(), now())
         ON CONFLICT (repo_id, version, type, analysis_id) DO NOTHING`,
        [row.analysisId, `# ${type}\n\nGenerated for benchmark.`, row.repoId, type, "seed-v1"],
      );
      inserted++;
    }
  }
  console.log(`  документов вставлено: ${inserted} для ${docs.rowCount ?? 0} анализов`);

  const after = await db.query(`
    SELECT
      (SELECT count(*) FROM pull_request_analyses WHERE risk_score > 10)::text AS bad_risk,
      (SELECT count(*) FROM analyses WHERE result_json ? 'graph')::text AS with_graph,
      (SELECT count(*) FROM documents)::text AS documents
  `);
  console.log(
    `\n  итог: risk_score вне диапазона=${after.rows[0]?.bad_risk}, с графом=${after.rows[0]?.with_graph}, документов=${after.rows[0]?.documents}`,
  );

  await db.end();
}

await main();
