import * as z from "zod";

import {
  ChangeCouplingSchema,
  ChurnHotspotSchema,
  DocumentationInputSchema,
  EntrypointRefSchema,
  FileCategoryBreakdownItemSchema,
  FrameworkFactSchema,
  GraphPreviewEdgeSchema,
  OpenApiInventorySchema,
  TsStaticHintSchema,
} from "./metrics.field-schemas";

const FileCategorySchema = z.enum([
  "asset",
  "benchmark",
  "config",
  "docs",
  "generated",
  "infra",
  "runtime-source",
  "test",
  "tooling",
]);

const AnalysisCoverageSchema = z.looseObject({
  heuristicFiles: z.number(),
  languagesByMode: z.looseObject({
    heuristic: z.array(z.string()),
    treeSitter: z.array(z.string()),
    typeScriptAst: z.array(z.string()),
  }),
  parserCoveragePercent: z.number(),
  totalFiles: z.number(),
  treeSitterFiles: z.number(),
  typeScriptAstFiles: z.number(),
});

const CloneRegionSchema = z.looseObject({
  endLine: z.number(),
  path: z.string(),
  startLine: z.number(),
});

const DuplicationReportSchema = z.looseObject({
  clones: z.array(
    z.looseObject({
      fragmentPreview: z.string(),
      lines: z.number(),
      primary: CloneRegionSchema,
      secondary: CloneRegionSchema,
    }),
  ),
  duplicationPercentage: z.number(),
  totalDuplicatedLines: z.number(),
});

const GraphReliabilitySchema = z.looseObject({
  resolvedEdges: z.number(),
  unresolvedImportSpecifiers: z.number(),
  unresolvedSamples: z.array(z.looseObject({ fromPath: z.string(), specifier: z.string() })),
});

const RouteInventorySchema = z.looseObject({
  estimatedOperations: z.number(),
  frameworks: z.array(z.string()),
  httpRoutes: z.array(
    z.looseObject({ method: z.string(), path: z.string(), sourcePath: z.string() }),
  ),
  rpcProcedures: z.number(),
  source: z.enum(["extracted", "mixed", "openapi"]),
  sourceFiles: z.array(z.string()),
});

const DependencyNodeMetricSchema = z.looseObject({
  exports: z.number(),
  inbound: z.number(),
  outbound: z.number(),
  path: z.string(),
});

const HotspotSignalSchema = z.looseObject({
  categories: z.array(FileCategorySchema),
  churnScore: z.number(),
  complexity: z.number(),
  confidence: z.number(),
  inbound: z.number(),
  lines: z.number().optional(),
  outbound: z.number(),
  path: z.string(),
  score: z.number(),
  // `HotspotSignal` narrows `source` to the risk model; only the risk-model
  // producer writes a row with `churnScore`/`score`, so accepting the other two
  // would let a shape through that the type then denies.
  source: z.literal("risk-model"),
});

const LanguageMetricSchema = z.looseObject({
  color: z.string(),
  lines: z.number(),
  name: z.string(),
});

const SecurityFindingMetricSchema = z.looseObject({
  line: z.number().optional(),
  message: z.string(),
  path: z.string(),
  severity: z.enum(["error", "warning"]),
});

const TeamRoleSchema = z.looseObject({
  login: z.string(),
  role: z.string(),
  share: z.number(),
});

export const RepoMetricsSchema = z.looseObject({
  analysisCoverage: AnalysisCoverageSchema,
  apiSurface: z.number(),
  busFactor: z.number(),
  changeCoupling: z.array(ChangeCouplingSchema).optional(),
  churnHotspots: z.array(ChurnHotspotSchema).optional(),
  complexityScore: z.number(),
  configFiles: z.number(),
  configInventory: z.array(z.string()),
  dependencyCycles: z.array(z.array(z.string())),
  dependencyHotspots: z.array(DependencyNodeMetricSchema),
  docDensity: z.number(),
  documentationInput: DocumentationInputSchema.optional(),
  duplicationReport: DuplicationReportSchema,
  entrypointDetails: z.array(EntrypointRefSchema).optional(),
  entrypoints: z.array(z.string()),
  factCount: z.number(),
  fileCategoryBreakdown: z.array(FileCategoryBreakdownItemSchema).optional(),
  fileCount: z.number(),
  findingCount: z.number(),
  frameworkFacts: z.array(FrameworkFactSchema).optional(),
  graphPreviewEdges: z.array(GraphPreviewEdgeSchema).optional(),
  graphReliability: GraphReliabilitySchema.optional(),
  healthScore: z.number(),
  hotspotFiles: z.array(z.string()),
  hotspotSignals: z.array(HotspotSignalSchema).optional(),
  languages: z.array(LanguageMetricSchema),
  maintenanceStatus: z.enum(["active", "dead", "stale"]),
  modularityIndex: z.number(),
  mostComplexFiles: z.array(z.string()),
  onboardingScore: z.number(),
  openapiInventory: OpenApiInventorySchema.optional(),
  orphanModules: z.array(z.string()),
  publicExports: z.number(),
  routeInventory: RouteInventorySchema.optional(),
  securityFindings: z.array(SecurityFindingMetricSchema),
  securityScanStatus: z.enum(["ok", "partial"]),
  securityScore: z.number(),
  teamRoles: z.array(TeamRoleSchema),
  techDebtScore: z.number(),
  techStack: z.array(z.string()),
  totalLoc: z.number(),
  totalSizeKb: z.number(),
  tsStaticHints: z.array(TsStaticHintSchema).optional(),
});

export type ParsedRepoMetrics = z.infer<typeof RepoMetricsSchema>;

export function parseRepoMetrics(value: unknown): ParsedRepoMetrics | null {
  const parsed = RepoMetricsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The `safeParse` form of {@link parseRepoMetrics}, for callers that need to know
 * *why* a blob was rejected. Kept separate so `parseRepoMetrics`' 11 existing
 * assertions and its `T | null` signature are untouched.
 */
export const safeParseRepoMetrics = (value: unknown): z.ZodSafeParseResult<ParsedRepoMetrics> =>
  RepoMetricsSchema.safeParse(value);

/**
 * The zero-valued metrics handed to callers whose stored blob failed validation.
 * `RepoMetrics` has 34 required fields, so a hand-written literal would drift from
 * the schema; parsing a canonical blank keeps the two in step by construction.
 */
export const EMPTY_REPO_METRICS: ParsedRepoMetrics = RepoMetricsSchema.parse({
  analysisCoverage: {
    heuristicFiles: 0,
    languagesByMode: { heuristic: [], treeSitter: [], typeScriptAst: [] },
    parserCoveragePercent: 0,
    totalFiles: 0,
    treeSitterFiles: 0,
    typeScriptAstFiles: 0,
  },
  apiSurface: 0,
  busFactor: 0,
  complexityScore: 0,
  configFiles: 0,
  configInventory: [],
  dependencyCycles: [],
  dependencyHotspots: [],
  docDensity: 0,
  duplicationReport: { clones: [], duplicationPercentage: 0, totalDuplicatedLines: 0 },
  entrypoints: [],
  factCount: 0,
  fileCount: 0,
  findingCount: 0,
  healthScore: 0,
  hotspotFiles: [],
  languages: [],
  maintenanceStatus: "active",
  modularityIndex: 0,
  mostComplexFiles: [],
  onboardingScore: 0,
  orphanModules: [],
  publicExports: 0,
  securityFindings: [],
  securityScanStatus: "ok",
  securityScore: 0,
  teamRoles: [],
  techDebtScore: 0,
  techStack: [],
  totalLoc: 0,
  totalSizeKb: 0,
});
