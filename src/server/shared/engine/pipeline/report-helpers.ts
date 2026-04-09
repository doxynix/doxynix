import type { EntrypointRef, ModuleRef, RouteInventory } from "../core/discovery.types";
import type {
  DocumentationAudience,
  ReportSectionInput,
  ReportSectionKind,
} from "../core/documentation.types";
import { ProjectPolicy } from "../core/project-policy";

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

function isPrimaryArchitectureModule(module: Pick<ModuleRef, "categories">) {
  return ProjectPolicy.isPrimaryArchitectureCategories(module.categories);
}

export function getPrimaryArchitectureModules(modules: ModuleRef[], limit = 24) {
  return sortArchitectureModules(
    modules.filter((module) => isPrimaryArchitectureModule(module))
  ).slice(0, limit);
}

export function getPrimaryEntrypointPaths(entrypoints: EntrypointRef[]) {
  return ProjectPolicy.filterPrimaryEntrypointPaths(
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
