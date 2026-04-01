import { FileClassifier } from "../core/file-classifier";
import type {
  DocumentationAudience,
  EntrypointRef,
  FileCategory,
  ModuleRef,
  ReportSectionInput,
  ReportSectionKind,
  RouteInventory,
} from "../core/types";

type SectionBuilderArgs<TBody> = {
  audience: DocumentationAudience | "mixed";
  body: TBody;
  confidence: number;
  evidencePaths: Array<string | null | undefined | false>;
  section: ReportSectionKind;
  summary: string[];
  title: string;
  unknowns: string[];
};

type RankedModule = Pick<ModuleRef, "apiSurface" | "exports" | "path" | "routeCount" | "symbols">;

const NON_ARCHITECTURE_CATEGORIES = new Set<FileCategory>([
  "asset",
  "benchmark",
  "docs",
  "generated",
  "test",
]);

const SECONDARY_EVIDENCE_CATEGORIES = new Set<FileCategory>([
  "asset",
  "benchmark",
  "config",
  "docs",
  "generated",
  "infra",
  "test",
  "tooling",
]);

export function clampSectionConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function uniquePaths(paths: Array<string | null | undefined | false>, limit?: number) {
  const deduped = Array.from(
    new Set(paths.filter((path): path is string => typeof path === "string" && path.length > 0))
  );
  return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
}

export function rankArchitectureModule(module: RankedModule) {
  return module.apiSurface * 6 + module.routeCount * 5 + module.exports * 2 + module.symbols.length;
}

export function sortArchitectureModules<TModule extends RankedModule>(modules: TModule[]) {
  return [...modules].sort(
    (left, right) =>
      rankArchitectureModule(right) - rankArchitectureModule(left) ||
      left.path.localeCompare(right.path)
  );
}

function isArchitectureRelevantModule(module: Pick<ModuleRef, "categories">) {
  return (
    module.categories.includes("runtime-source") &&
    !module.categories.some((category) => NON_ARCHITECTURE_CATEGORIES.has(category))
  );
}

function isPrimaryArchitectureModule(module: Pick<ModuleRef, "categories">) {
  return (
    isArchitectureRelevantModule(module) &&
    !module.categories.some((category) => SECONDARY_EVIDENCE_CATEGORIES.has(category))
  );
}

export function getPrimaryArchitectureModules(modules: ModuleRef[], limit = 24) {
  return sortArchitectureModules(
    modules.filter((module) => isPrimaryArchitectureModule(module))
  ).slice(0, limit);
}

export function getPrimaryEntrypointPaths(entrypoints: EntrypointRef[]) {
  return FileClassifier.filterPrimaryEntrypointPaths(
    entrypoints
      .filter((entrypoint) => entrypoint.kind === "library" || entrypoint.kind === "runtime")
      .map((entrypoint) => entrypoint.path)
  );
}

export function getSecondaryEntrypointPaths(entrypoints: EntrypointRef[]) {
  return entrypoints
    .filter((entrypoint) => entrypoint.kind !== "library" && entrypoint.kind !== "runtime")
    .map((entrypoint) => entrypoint.path);
}

export function inferRepositoryKind(params: {
  primaryEntrypoints: string[];
  routeInventory: RouteInventory;
}) {
  const hasRuntimeEntrypoint = params.primaryEntrypoints.some(
    (path) => !/\/index\.[cm]?[jt]sx?$/iu.test(path)
  );
  const hasLibrarySurface = params.primaryEntrypoints.some((path) =>
    /\/index\.[cm]?[jt]sx?$/iu.test(path)
  );
  const hasApiSurface = params.routeInventory.estimatedOperations > 0;

  if ((hasRuntimeEntrypoint || hasApiSurface) && hasLibrarySurface) return "mixed";
  if (hasRuntimeEntrypoint || hasApiSurface) return "service";
  if (hasLibrarySurface) return "library";
  return "unknown";
}

export function buildSectionInput<TBody>(
  args: SectionBuilderArgs<TBody>
): ReportSectionInput<TBody> {
  return {
    audience: args.audience,
    body: args.body,
    confidence: clampSectionConfidence(args.confidence),
    evidencePaths: uniquePaths(args.evidencePaths),
    section: args.section,
    summary: args.summary,
    title: args.title,
    unknowns: args.unknowns,
  };
}

export function buildReferenceEvidencePaths(params: {
  fallbackPaths?: string[];
  limit?: number;
  modules: RankedModule[];
  primaryEntrypoints: string[];
}) {
  if (params.primaryEntrypoints.length > 0) {
    return uniquePaths(params.primaryEntrypoints, params.limit);
  }

  const modulePaths = sortArchitectureModules(params.modules)
    .slice(0, params.limit ?? 12)
    .map((module) => module.path);

  return uniquePaths(
    modulePaths.length > 0 ? modulePaths : (params.fallbackPaths ?? []),
    params.limit
  );
}
