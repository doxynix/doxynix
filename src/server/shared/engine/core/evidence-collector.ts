import { basename } from "pathe";

import { normalizeRepoPath } from "./common";
import type { EntrypointKind, ModuleRef } from "./discovery.types";
import type {
  CollectedFileEvidence,
  DependencyTracking,
  EvidenceLookups,
  NormalizedRepositoryFile,
} from "./evidence-support";
import { ProjectPolicy } from "./project-policy";
import { CONFIDENCE_LEVELS } from "./scoring-constants";

const SCRIPTS_DIR_REGEX = /^scripts\//iu;
const CLI_DIR_REGEX = /^cli\//iu;
const BARREL_FILE_REGEX = /(?:^|[/\\])index\.[cm]?[jt]sx?$/i; // NOTE: дубль

export function kindForFile(path: string, categories: string[]): EntrypointKind {
  if (categories.includes("benchmark")) return "benchmark";
  if (categories.includes("test")) return "test";
  if (categories.includes("infra")) return "infra";
  if (categories.includes("tooling") || SCRIPTS_DIR_REGEX.test(path) || CLI_DIR_REGEX.test(path)) {
    return "tooling";
  }
  if (BARREL_FILE_REGEX.test(path)) return "library";
  return "runtime";
}

export async function collectFileEvidence(
  file: NormalizedRepositoryFile,
  lookups: Pick<EvidenceLookups, "aliasRules" | "filesByBaseName" | "fileSet">,
  tracking: DependencyTracking,
  fileSignalsByPath: Map<string, CollectedFileEvidence["signals"]>,
  resolveImportEdges: (
    filePath: string,
    imports: string[],
    innerLookups: Pick<EvidenceLookups, "aliasRules" | "filesByBaseName" | "fileSet">,
    innerTracking: DependencyTracking
  ) => string[]
): Promise<CollectedFileEvidence> {
  const signals =
    fileSignalsByPath.get(file.path) ?? fileSignalsByPath.get(normalizeRepoPath(file.path));

  if (signals == null) {
    throw new Error(`Missing pre-collected FileSignals for ${file.path}`);
  }

  resolveImportEdges(file.path, signals.imports, lookups, tracking);

  const isConfig = ProjectPolicy.isConfigFile(file.path);

  return {
    apiSurface: signals.apiSurface,
    configs: [
      ...(isConfig
        ? [
            {
              confidence: CONFIDENCE_LEVELS.configDiscovery,
              kind: basename(file.path) || "config",
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
  const categories = signals.categories ?? ProjectPolicy.getCategories(filePath);

  return {
    apiSurface: signals.apiSurface,
    categories,
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
