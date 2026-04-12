import pm from "picomatch";

import { unique } from "../../lib/array-utils";
import { normalizeRepoPath } from "./common";
import type { FileCategory } from "./discovery.types";
import {
  PATH_PATTERNS,
  PROJECT_POLICY_RULES,
  type ProjectPolicySemanticKind,
} from "./project-policy-rules";

type PathExplanation = {
  categories: FileCategory[];
  groupId: string;
  ignored: boolean;
  isApiSurface: boolean;
  isArchitectureRelevant: boolean;
  isEntrypoint: boolean;
  isGraphPreviewCandidate: boolean;
  isLowSignalConfig: boolean;
  isRuntimeSource: boolean;
  reasons: string[];
  semanticKinds: ProjectPolicySemanticKind[];
  sensitive: boolean;
};

function compileMatcher(patterns: string | readonly string[]) {
  const values = Array.isArray(patterns) ? patterns : [patterns];
  return pm(values.map((pattern) => pattern.toLowerCase()));
}

const matchers = {
  api: compileMatcher(PATH_PATTERNS.API),
  asset: compileMatcher(PATH_PATTERNS.ASSET),
  benchmark: compileMatcher(PATH_PATTERNS.BENCHMARK),
  config: compileMatcher(PATH_PATTERNS.CONFIG),
  docs: compileMatcher(PATH_PATTERNS.DOCS),
  generated: compileMatcher(PATH_PATTERNS.GENERATED),
  ignored: compileMatcher(PATH_PATTERNS.IGNORE),
  infra: compileMatcher([...PATH_PATTERNS.INFRA, ...PATH_PATTERNS.INFRA_DIRS]),
  runtimeSource: compileMatcher(PATH_PATTERNS.RUNTIME_SOURCE),
  sensitive: compileMatcher(PATH_PATTERNS.SENSITIVE),
  test: compileMatcher(PATH_PATTERNS.TEST),
  tooling: compileMatcher(PATH_PATTERNS.TOOLING),
};

function normalizePolicyPath(path: string) {
  return normalizeRepoPath(path);
}

function lowerPolicyPath(path: string) {
  return normalizePolicyPath(path).toLowerCase();
}

function splitPath(path: string) {
  return normalizePolicyPath(path).split("/").filter(Boolean);
}

function splitLowerPath(path: string) {
  return lowerPolicyPath(path).split("/").filter(Boolean);
}

function hasAnySegment(path: string, candidates: readonly string[]) {
  const segments = splitLowerPath(path);
  return segments.some((segment) => candidates.includes(segment));
}

function hasPrefix(path: string, prefixes: readonly string[]) {
  const lower = lowerPolicyPath(path);
  return prefixes.some((prefix) => lower.startsWith(prefix));
}

export const ProjectPolicy = {
  classifyPath(path: string): PathExplanation {
    const normalizedPath = normalizePolicyPath(path);
    const categories = this.getCategories(normalizedPath);
    const semanticKinds = this.getSemanticKinds(normalizedPath);
    const reasons: string[] = [];

    if (this.isIgnored(normalizedPath)) reasons.push("ignored-by-policy");
    if (this.isSensitive(normalizedPath)) reasons.push("sensitive");
    if (this.isLowSignalConfig(normalizedPath)) reasons.push("low-signal-config");
    if (this.isPrimaryEntrypoint(normalizedPath)) reasons.push("primary-entrypoint");
    if (this.isPrimaryApiSurface(normalizedPath)) reasons.push("api-surface");
    if (this.isArchitectureRelevant(normalizedPath)) reasons.push("architecture-relevant");
    if (this.isGraphPreviewCandidate(normalizedPath)) reasons.push("graph-preview-candidate");

    return {
      categories,
      groupId: this.deriveGroupId(normalizedPath),
      ignored: this.isIgnored(normalizedPath),
      isApiSurface: this.isPrimaryApiSurface(normalizedPath),
      isArchitectureRelevant: this.isArchitectureRelevant(normalizedPath),
      isEntrypoint: this.isPrimaryEntrypoint(normalizedPath),
      isGraphPreviewCandidate: this.isGraphPreviewCandidate(normalizedPath),
      isLowSignalConfig: this.isLowSignalConfig(normalizedPath),
      isRuntimeSource: this.isRuntimeSource(normalizedPath),
      reasons,
      semanticKinds,
      sensitive: this.isSensitive(normalizedPath),
    };
  },

  deriveGroupId(path: string) {
    const normalized = normalizePolicyPath(path);
    const parts = splitPath(normalized);
    const lowerParts = splitLowerPath(normalized);

    if (parts.length === 0) return "other";
    if (parts[0] != null && parts[0].startsWith(".")) return parts[0];

    if (
      lowerParts[0] === "src" &&
      lowerParts[1] != null &&
      (lowerParts[1] === "main" || lowerParts[1] === "test") &&
      lowerParts[2] != null &&
      PROJECT_POLICY_RULES.grouping.jvmSourceRoots.has(lowerParts[2])
    ) {
      if (lowerParts[2] === "resources") return `src/${parts[1]}/${parts[2]}`;
      return `src/${parts[1]}/${parts[2]}/${parts[3]}`;
    }

    if (lowerParts[0] != null && lowerParts[0] === "src") {
      if (parts.length < 2) return "src";
      if (parts.length < 3) return `src/${parts[1]}`;
      return `src/${parts[1]}/${parts[2]}`;
    }

    if (lowerParts[0] != null && PROJECT_POLICY_RULES.grouping.groupingRoots.has(lowerParts[0])) {
      return `${parts[0]}/${parts[1]}`;
    }

    return parts[0] ?? "other";
  },

  explainGroupDecision(groupId: string) {
    return {
      broadGeneric: this.isBroadGenericGroupPath(groupId),
      genericPenalty: this.getGenericGroupPathPenalty(groupId),
      groupId,
      label: this.getGroupLabel(groupId),
    };
  },

  explainPathDecision(path: string) {
    return this.classifyPath(path);
  },

  filterPrimaryApiSurfacePaths(paths: string[], limit?: number) {
    const deduped = unique(paths.filter((path) => this.isPrimaryApiSurface(path)));
    return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
  },

  filterPrimaryEntrypointPaths(paths: string[], limit?: number) {
    const deduped = unique(paths.filter((path) => this.isPrimaryEntrypoint(path)));
    const preferred = deduped.filter((path) => !this.isLikelyBarrelFile(path));
    const output = preferred.length > 0 ? preferred : deduped;
    return typeof limit === "number" ? output.slice(0, limit) : output;
  },

  getCategories(path: string): FileCategory[] {
    const lower = lowerPolicyPath(path);
    const categories = new Set<FileCategory>();

    if (matchers.asset(lower)) categories.add("asset");
    if (matchers.benchmark(lower)) categories.add("benchmark");
    if (matchers.config(lower)) categories.add("config");
    if (matchers.docs(lower)) categories.add("docs");
    if (matchers.generated(lower)) categories.add("generated");
    if (matchers.infra(lower)) categories.add("infra");
    if (matchers.test(lower)) categories.add("test");
    if (matchers.tooling(lower)) categories.add("tooling");

    if (
      this.isRuntimeSource(lower) ||
      (categories.size === 0 && !this.isIgnored(lower) && !this.isSensitive(lower))
    ) {
      categories.add("runtime-source");
    }

    return Array.from(categories);
  },

  getGenericGroupPathPenalty(groupId: string) {
    const normalized = normalizePolicyPath(groupId);
    if (normalized === "other") return 12;
    if (this.isBroadGenericGroupPath(normalized)) return 10;
    return 0;
  },

  getGroupLabel(groupId: string) {
    const parts = normalizePolicyPath(groupId).split("/").filter(Boolean);
    const raw =
      parts[0] === "src" && (parts[1] === "main" || parts[1] === "test")
        ? parts.slice(-3).join(" / ")
        : parts.slice(-2).join(" / ");
    return raw.replace(/[-_]/g, " ");
  },

  getPrimaryCategory(path: string): FileCategory {
    const categories = this.getCategories(path);
    const priority: FileCategory[] = [
      "generated",
      "asset",
      "docs",
      "benchmark",
      "test",
      "infra",
      "tooling",
      "config",
      "runtime-source",
    ];

    return priority.find((category) => categories.includes(category)) ?? "runtime-source";
  },

  getPrimarySemanticKind(
    counts: Record<ProjectPolicySemanticKind, number>
  ): ProjectPolicySemanticKind {
    return (
      (Object.entries(counts).sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
      )[0]?.[0] as ProjectPolicySemanticKind | undefined) ?? "unknown"
    );
  },

  getSemanticKinds(
    path: string,
    options?: { apiPaths?: ReadonlySet<string> }
  ): ProjectPolicySemanticKind[] {
    const normalized = normalizePolicyPath(path);
    const lower = lowerPolicyPath(path);
    const kinds = new Set<ProjectPolicySemanticKind>();

    if (
      options?.apiPaths?.has(normalized) === true ||
      this.isApiPath(normalized) ||
      hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.apiSegments)
    ) {
      kinds.add("api");
    }
    if (
      hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.backendSegments) ||
      hasPrefix(normalized, PROJECT_POLICY_RULES.semanticPrefixes.backend)
    ) {
      kinds.add("backend");
    }
    if (
      hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.frontendSegments) ||
      hasPrefix(normalized, PROJECT_POLICY_RULES.semanticPrefixes.frontend)
    ) {
      kinds.add("frontend");
    }
    if (
      hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.sharedSegments) ||
      hasPrefix(normalized, PROJECT_POLICY_RULES.semanticPrefixes.shared)
    ) {
      kinds.add("shared");
    }
    if (hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.coreSegments)) {
      kinds.add("core");
    }
    if (hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.dataSegments)) {
      kinds.add("data");
    }
    if (
      this.isInfraFile(normalized) ||
      hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.infrastructureSegments)
    ) {
      kinds.add("infrastructure");
    }
    if (
      hasAnySegment(normalized, PROJECT_POLICY_RULES.semantics.configSegments) ||
      this.isConfigFile(normalized) ||
      PROJECT_POLICY_RULES.fileHints.polyglotConfigHints.some((hint) => lower.endsWith(hint))
    ) {
      kinds.add("config");
    }

    if (kinds.size === 0) kinds.add("unknown");
    return Array.from(kinds);
  },

  isApiPath(path: string) {
    const lower = lowerPolicyPath(path);
    if (this.isTestFile(lower)) return false;
    return matchers.api(lower);
  },

  isArchitectureRelevant(path: string) {
    return this.isArchitectureRelevantCategories(this.getCategories(path));
  },

  isArchitectureRelevantCategories(categories: readonly FileCategory[]) {
    return (
      categories.includes("runtime-source") &&
      !categories.some((category) =>
        PROJECT_POLICY_RULES.categoryPolicy.nonArchitectureCategories.has(category)
      )
    );
  },

  isAssetFile(path: string) {
    return matchers.asset(lowerPolicyPath(path));
  },

  isBenchmarkFile(path: string) {
    return matchers.benchmark(lowerPolicyPath(path));
  },

  isBroadGenericGroupPath(groupPath: string) {
    const normalized = normalizePolicyPath(groupPath);
    if (normalized === "other") return true;
    if (normalized.startsWith(".")) return true;

    const parts = normalized.split("/").filter(Boolean);
    const lowerParts = parts.map((part) => part.toLowerCase());
    if (parts.length === 0) return true;
    if (
      lowerParts.length === 1 &&
      PROJECT_POLICY_RULES.grouping.genericGroupRoots.has(lowerParts[0] ?? "")
    ) {
      return true;
    }
    if (lowerParts[0] === "src" && lowerParts.length === 1) return true;
    if (
      /^src\/[^/]+$/u.test(normalized) &&
      !/^src\/(app|api|server|shared|core|features|entities|widgets)$/iu.test(normalized)
    ) {
      return true;
    }

    return false;
  },

  isConfigFile(path: string) {
    return matchers.config(lowerPolicyPath(path));
  },

  isDependencyLockfile(path: string) {
    const lower = lowerPolicyPath(path);
    return PROJECT_POLICY_RULES.fileHints.dependencyLockfiles.some(
      (fileName) => lower === fileName || lower.endsWith(`/${fileName}`)
    );
  },

  isDocsFile(path: string) {
    return matchers.docs(lowerPolicyPath(path));
  },

  isFrameworkFactSource(path: string) {
    const normalized = normalizePolicyPath(path);
    if (this.isPrimaryContourExcluded(normalized)) return false;
    if (this.isToolingFile(normalized)) return false;
    if (this.isLowSignalConfig(normalized)) return false;
    if (this.isInfraFile(normalized) && !this.isApiPath(normalized)) return false;
    return this.isPrimaryArchitecturePath(normalized) || this.isApiPath(normalized);
  },

  isGeneratedFile(path: string) {
    return matchers.generated(lowerPolicyPath(path));
  },

  isGraphPreviewCandidate(path: string) {
    const normalized = normalizePolicyPath(path);
    if (this.isSensitive(normalized)) return false;
    if (this.isIgnored(normalized)) return false;
    if (this.isDocsFile(normalized)) return false;
    if (this.isGeneratedFile(normalized)) return false;
    if (this.isTestFile(normalized)) return false;
    if (this.isAssetFile(normalized)) return false;
    if (this.isToolingFile(normalized)) return false;
    if (this.isLowSignalConfig(normalized)) return false;

    return (
      this.isArchitectureRelevant(normalized) ||
      this.isApiPath(normalized) ||
      this.isConfigFile(normalized)
    );
  },

  isIgnored(path: string) {
    return matchers.ignored(lowerPolicyPath(path));
  },

  isInfraFile(path: string) {
    return matchers.infra(lowerPolicyPath(path));
  },

  isLikelyBarrelFile(path: string) {
    const lower = lowerPolicyPath(path);
    if (!/(^|\/)index\.[^/]+$/iu.test(lower)) return false;

    const normalized = lower.startsWith("src/") ? lower.slice(4) : lower;
    const segments = normalized.split("/");

    if (segments.length <= 2) return false;
    if (/^(app|pages|server|cli|bin|scripts)\//iu.test(normalized)) return false;
    if (/(^|\/)(api|routes)\//iu.test(normalized)) return false;

    return true;
  },

  isLowSignalConfig(path: string) {
    const lower = lowerPolicyPath(path);
    if (this.isDependencyLockfile(lower)) return true;
    if (/^prisma\/migrations\/[^/]+\/migration\.sql$/u.test(lower)) return true;
    if (
      PROJECT_POLICY_RULES.fileHints.lowSignalConfigNames.some(
        (fileName) => lower === fileName || lower.endsWith(`/${fileName}`)
      )
    ) {
      return true;
    }
    return /[.-](min)\.(js|cjs|mjs|css)$/iu.test(lower);
  },

  isPrimaryApiSurface(path: string) {
    const normalized = normalizePolicyPath(path);
    if (this.isPrimaryContourExcluded(normalized)) return false;
    if (this.isConfigFile(normalized) || this.isToolingFile(normalized)) return false;
    if (this.isLowSignalConfig(normalized)) return false;
    if (this.isInfraFile(normalized) && !this.isApiPath(normalized)) return false;
    return this.isApiPath(normalized) || this.isPrimaryArchitecturePath(normalized);
  },

  isPrimaryArchitectureCategories(categories: readonly FileCategory[]) {
    return (
      this.isArchitectureRelevantCategories(categories) &&
      !categories.some((category) =>
        PROJECT_POLICY_RULES.categoryPolicy.secondaryEvidenceCategories.has(category)
      )
    );
  },

  isPrimaryArchitecturePath(path: string) {
    return this.isPrimaryArchitectureCategories(this.getCategories(path));
  },

  isPrimaryContourExcluded(path: string) {
    const normalized = normalizePolicyPath(path);
    return (
      this.isAssetFile(normalized) ||
      this.isBenchmarkFile(normalized) ||
      this.isDocsFile(normalized) ||
      this.isGeneratedFile(normalized) ||
      this.isTestFile(normalized)
    );
  },

  isPrimaryEntrypoint(path: string) {
    const normalized = normalizePolicyPath(path);
    if (this.isPrimaryContourExcluded(normalized)) return false;
    if (
      this.isConfigFile(normalized) ||
      this.isInfraFile(normalized) ||
      this.isToolingFile(normalized)
    ) {
      return false;
    }
    if (this.isLowSignalConfig(normalized)) return false;
    return (
      this.isRuntimeSource(normalized) ||
      /(^|\/)(index|main|server|app)\.[^/]+$/iu.test(lowerPolicyPath(normalized))
    );
  },

  isRuntimeSource(path: string) {
    const normalized = normalizePolicyPath(path);
    if (
      this.isAssetFile(normalized) ||
      this.isBenchmarkFile(normalized) ||
      this.isConfigFile(normalized) ||
      this.isDocsFile(normalized) ||
      this.isGeneratedFile(normalized) ||
      this.isTestFile(normalized) ||
      this.isToolingFile(normalized)
    ) {
      return false;
    }
    return matchers.runtimeSource(lowerPolicyPath(normalized)) || this.isApiPath(normalized);
  },

  isSensitive(path: string) {
    const lower = lowerPolicyPath(path);
    if (lower.endsWith(".env.example")) return false;
    return matchers.sensitive(lower);
  },

  isStructureCandidate(path: string) {
    const normalized = normalizePolicyPath(path);
    if (this.isSensitive(normalized)) return false;
    if (this.isIgnored(normalized)) return false;
    if (this.isLikelyBarrelFile(normalized)) return false;
    if (this.isDocsFile(normalized)) return false;
    if (this.isGeneratedFile(normalized)) return false;
    if (this.isTestFile(normalized)) return false;
    if (this.isAssetFile(normalized)) return false;
    if (this.isToolingFile(normalized)) return false;
    if (this.isLowSignalConfig(normalized)) return false;
    return (
      this.isArchitectureRelevant(normalized) ||
      this.isApiPath(normalized) ||
      this.isConfigFile(normalized)
    );
  },

  isTestFile(path: string) {
    return matchers.test(lowerPolicyPath(path));
  },

  isToolingFile(path: string) {
    return matchers.tooling(lowerPolicyPath(path));
  },

  isUsefulComplexityCandidate(path: string) {
    const normalized = normalizePolicyPath(path);
    if (this.isPrimaryContourExcluded(normalized)) return false;
    if (
      this.isConfigFile(normalized) ||
      this.isDocsFile(normalized) ||
      this.isToolingFile(normalized)
    )
      return false;
    if (this.isLowSignalConfig(normalized)) return false;
    if (this.isLikelyBarrelFile(normalized)) return false;
    return this.isArchitectureRelevant(normalized) || this.isApiPath(normalized);
  },
} as const;

export type ProjectPolicyApi = typeof ProjectPolicy;
