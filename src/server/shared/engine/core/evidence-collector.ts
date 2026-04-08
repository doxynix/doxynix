import { normalizeRepoPath } from "./common";
import type { EntrypointKind, ModuleRef } from "./discovery.types";
import type {
  CollectedFileEvidence,
  DependencyTracking,
  EvidenceLookups,
  NormalizedRepositoryFile,
} from "./evidence-support";
import { ProjectPolicy } from "./project-policy";

export function kindForFile(path: string, categories: string[]): EntrypointKind {
  if (categories.includes("benchmark")) return "benchmark";
  if (categories.includes("test")) return "test";
  if (categories.includes("infra")) return "infra";
  if (categories.includes("tooling") || /^scripts\//iu.test(path) || /^cli\//iu.test(path)) {
    return "tooling";
  }
  if (/\/index\.[cm]?[jt]sx?$/iu.test(path)) return "library";
  return "runtime";
}

export async function collectFileEvidence(
  file: NormalizedRepositoryFile,
  lookups: Pick<EvidenceLookups, "aliasRules" | "fileSet" | "filesByBaseName">,
  tracking: DependencyTracking,
  fileSignalsByPath: Map<string, CollectedFileEvidence["signals"]>,
  resolveImportEdges: (
    filePath: string,
    imports: string[],
    innerLookups: Pick<EvidenceLookups, "aliasRules" | "fileSet" | "filesByBaseName">,
    innerTracking: DependencyTracking
  ) => string[]
): Promise<CollectedFileEvidence> {
  const signals =
    fileSignalsByPath.get(file.path) ?? fileSignalsByPath.get(normalizeRepoPath(file.path));
  if (signals == null) {
    throw new Error(`Missing pre-collected FileSignals for ${file.path}`);
  }
  resolveImportEdges(file.path, signals.imports, lookups, tracking);

  return {
    apiSurface: signals.apiSurface,
    configs: [
      ...(ProjectPolicy.isConfigFile(file.path)
        ? [
            {
              confidence: 90,
              kind: file.path.split("/").at(-1) ?? "config",
              path: file.path,
            },
          ]
        : []),
      ...(signals.configRefs ?? []),
    ],
    entrypointHints: [...(signals.entrypointRefs ?? [])],
    exports: signals.exports,
    imports: signals.imports,
    routes: signals.routes ?? [],
    signals,
    symbols: signals.symbols ?? [],
  };
}

export function buildModuleRef(
  filePath: string,
  signals: CollectedFileEvidence["signals"],
  entrypointHints: CollectedFileEvidence["entrypointHints"]
): ModuleRef {
  return {
    apiSurface: signals.apiSurface,
    categories: signals.categories ?? ProjectPolicy.getCategories(filePath),
    entrypointHints,
    exports: signals.exports,
    frameworkHints: signals.frameworkHints ?? [],
    imports: signals.imports,
    parseTier: signals.analysisMode,
    path: filePath,
    routeCount: (signals.routes ?? []).length,
    symbols: signals.symbols ?? [],
  };
}
