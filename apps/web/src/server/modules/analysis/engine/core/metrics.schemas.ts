import * as z from "zod";

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
  score: z.number().optional(),
  source: z.enum(["analysis", "extraction", "risk-model"]),
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
  changeCoupling: z.unknown().optional(),
  churnHotspots: z.unknown().optional(),
  complexityScore: z.number(),
  configFiles: z.number(),
  configInventory: z.array(z.string()),
  dependencyCycles: z.array(z.array(z.string())),
  dependencyHotspots: z.array(DependencyNodeMetricSchema),
  docDensity: z.number(),
  documentationInput: z.unknown().optional(),
  duplicationReport: DuplicationReportSchema,
  entrypointDetails: z.unknown().optional(),
  entrypoints: z.array(z.string()),
  factCount: z.number().optional(),
  fileCategoryBreakdown: z.unknown().optional(),
  fileCount: z.number(),
  findingCount: z.number().optional(),
  frameworkFacts: z.unknown().optional(),
  graphPreviewEdges: z.unknown().optional(),
  graphReliability: GraphReliabilitySchema.optional(),
  healthScore: z.number(),
  hotspotFiles: z.array(z.string()),
  hotspotSignals: z.array(HotspotSignalSchema).optional(),
  languages: z.array(LanguageMetricSchema),
  maintenanceStatus: z.enum(["active", "dead", "stale"]),
  modularityIndex: z.number(),
  mostComplexFiles: z.array(z.string()),
  onboardingScore: z.number(),
  openapiInventory: z.unknown().optional(),
  orphanModules: z.array(z.string()),
  publicExports: z.number().optional(),
  routeInventory: RouteInventorySchema.optional(),
  securityFindings: z.array(SecurityFindingMetricSchema),
  securityScanStatus: z.enum(["ok", "partial"]),
  securityScore: z.number(),
  teamRoles: z.array(TeamRoleSchema),
  techDebtScore: z.number(),
  techStack: z.array(z.string()),
  totalLoc: z.number(),
  totalSizeKb: z.number(),
  tsStaticHints: z.unknown().optional(),
});

export type ParsedRepoMetrics = z.infer<typeof RepoMetricsSchema>;

export function parseRepoMetrics(value: unknown): ParsedRepoMetrics | null {
  const parsed = RepoMetricsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
