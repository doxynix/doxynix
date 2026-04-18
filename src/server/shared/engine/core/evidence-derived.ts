import type { DependencyNodeMetric } from "../../types";
import type {
  ConfigRef,
  EntrypointRef,
  FileCategoryBreakdownItem,
  ModuleRef,
} from "./discovery.types";
import { kindForFile } from "./evidence-collector";
import { ProjectPolicy } from "./project-policy";
import { ARCHITECTURE_WEIGHTS, CONFIDENCE_LEVELS } from "./scoring-constants";

function dedupeEntrypoints(entrypoints: EntrypointRef[]) {
  const seen = new Map<string, EntrypointRef>();

  for (const entrypoint of entrypoints) {
    const key = `${entrypoint.kind}:${entrypoint.path}`;
    const existing = seen.get(key);
    if (existing == null || existing.confidence < entrypoint.confidence) {
      seen.set(key, entrypoint);
    }
  }

  return Array.from(seen.values()).sort(
    (left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path)
  );
}

export function inferEntrypoints(params: {
  apiSurfaceByFile: Map<string, number>;
  exportsByFile: Map<string, number>;
  inboundByFile: Map<string, number>;
  moduleByPath: Map<string, ModuleRef>;
}) {
  const entrypoints: EntrypointRef[] = [];

  const normalizeHint = (
    hint: EntrypointRef,
    filePath: string,
    categories: string[]
  ): EntrypointRef => {
    if (hint.kind === "library" || hint.kind === "runtime") {
      if (ProjectPolicy.isPrimaryEntrypoint(hint.path)) {
        return hint;
      }

      return {
        ...hint,
        kind: kindForFile(filePath, categories),
        reason: `${hint.reason}; downgraded because the file sits outside the primary runtime contour`,
      };
    }

    return hint;
  };

  for (const [filePath, module] of params.moduleByPath.entries()) {
    const inbound = params.inboundByFile.get(filePath) ?? 0;
    const apiSurface = params.apiSurfaceByFile.get(filePath) ?? 0;
    const exports = params.exportsByFile.get(filePath) ?? 0;
    const categories = module.categories;
    const primaryKind = kindForFile(filePath, categories);

    entrypoints.push(
      ...module.entrypointHints.map((hint) => normalizeHint(hint, filePath, categories))
    );

    if (
      primaryKind === "runtime" &&
      inbound === 0 &&
      (apiSurface > 0 || module.entrypointHints.length > 0) &&
      ProjectPolicy.isPrimaryEntrypoint(filePath)
    ) {
      entrypoints.push({
        confidence: apiSurface > 0 ? 86 : 74,
        kind: "runtime",
        path: filePath,
        reason:
          apiSurface > 0
            ? "top-level API surface with no inbound dependencies"
            : "runtime source with bootstrap hints",
      });
    }

    if (
      ProjectPolicy.isPrimaryEntrypoint(filePath) &&
      ProjectPolicy.isArchitectureRelevant(filePath) &&
      inbound === 0 &&
      exports > 0 &&
      /\/index\.[cm]?[jt]sx?$/iu.test(filePath)
    ) {
      entrypoints.push({
        confidence: 72,
        kind: "library",
        path: filePath,
        reason: "export-heavy index file with no inbound references suggests public surface",
      });
    }

    if (
      (primaryKind === "tooling" ||
        primaryKind === "benchmark" ||
        primaryKind === "test" ||
        primaryKind === "infra") &&
      inbound === 0
    ) {
      entrypoints.push({
        confidence: 58,
        kind: primaryKind,
        path: filePath,
        reason: "isolated non-runtime file kept as secondary entrypoint evidence",
      });
    }
  }

  return dedupeEntrypoints(entrypoints);
}

export function buildMainEntrypointPaths(entrypoints: EntrypointRef[]) {
  return new Set(
    entrypoints
      .filter((entrypoint) => entrypoint.kind === "runtime" || entrypoint.kind === "library")
      .filter((entrypoint) => ProjectPolicy.isPrimaryEntrypoint(entrypoint.path))
      .map((entrypoint) => entrypoint.path)
  );
}

export function buildOrphanModules(
  modules: ModuleRef[],
  inboundByFile: Map<string, number>,
  mainEntrypointPaths: Set<string>
) {
  return modules
    .filter((module) => {
      if (!ProjectPolicy.isArchitectureRelevant(module.path)) return false;
      if (mainEntrypointPaths.has(module.path)) return false;
      return (inboundByFile.get(module.path) ?? 0) === 0;
    })
    .map((module) => module.path);
}

export function buildDependencyHotspots(
  modules: ModuleRef[],
  exportsByFile: Map<string, number>,
  inboundByFile: Map<string, number>,
  graph: Map<string, Set<string>>
) {
  return modules
    .filter((module) => ProjectPolicy.isArchitectureRelevant(module.path))
    .map<DependencyNodeMetric>((module) => ({
      exports: exportsByFile.get(module.path) ?? 0,
      inbound: inboundByFile.get(module.path) ?? 0,
      outbound: graph.get(module.path)?.size ?? 0,
      path: module.path,
    }))
    .sort((left, right) => {
      const leftScore =
        left.inbound * ARCHITECTURE_WEIGHTS.inboundMultiplier +
        left.outbound * ARCHITECTURE_WEIGHTS.outboundMultiplier +
        left.exports * ARCHITECTURE_WEIGHTS.exportMultiplier;
      const rightScore =
        right.inbound * ARCHITECTURE_WEIGHTS.inboundMultiplier +
        right.outbound * ARCHITECTURE_WEIGHTS.outboundMultiplier +
        right.exports * ARCHITECTURE_WEIGHTS.exportMultiplier;
      return rightScore - leftScore;
    });
}

export function buildHotspotSignals(
  modules: ModuleRef[],
  complexityByFile: Map<string, number>,
  inboundByFile: Map<string, number>,
  graph: Map<string, Set<string>>
) {
  return modules
    .filter((module) => ProjectPolicy.isArchitectureRelevant(module.path))
    .map((module) => {
      const inbound = inboundByFile.get(module.path) ?? 0;
      const outbound = graph.get(module.path)?.size ?? 0;
      const complexity = complexityByFile.get(module.path) ?? 0;
      const score =
        complexity * ARCHITECTURE_WEIGHTS.complexityOffset +
        inbound * ARCHITECTURE_WEIGHTS.riskInboundMultiplier +
        outbound * ARCHITECTURE_WEIGHTS.riskOutboundMultiplier +
        module.apiSurface * 4 +
        module.exports * 2;

      return {
        categories: module.categories,
        churnScore: 0,
        complexity,
        confidence: CONFIDENCE_LEVELS.tsInferred,
        inbound,
        outbound,
        path: module.path,
        score: Math.round(score),
        source: "risk-model" as const,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function buildFileCategoryBreakdown(modules: ModuleRef[]): FileCategoryBreakdownItem[] {
  return Array.from(
    modules.reduce((acc, module) => {
      for (const category of module.categories) {
        acc.set(category, (acc.get(category) ?? 0) + 1);
      }
      return acc;
    }, new Map<string, number>())
  )
    .map(([category, count]) => ({
      category: category as FileCategoryBreakdownItem["category"],
      count,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

export function dedupeConfigs(configs: ConfigRef[]) {
  return configs
    .filter(
      (config, index, all) =>
        all.findIndex(
          (candidate) => candidate.path === config.path && candidate.kind === config.kind
        ) === index
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}
