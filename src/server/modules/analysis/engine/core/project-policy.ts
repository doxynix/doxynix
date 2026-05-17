import { orderBy, uniq } from "es-toolkit";
import { normalize } from "pathe";
import pm from "picomatch";

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

const FRONTEND_DIRS_SET = new Set<string>(PROJECT_POLICY_RULES.semantics.frontendDirectories);

function compileMatcher(patterns: readonly string[] | string) {
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

function hasAnySegment(path: string, candidates: readonly string[]) {
  const segments = normalize(path).toLowerCase().split("/").filter(Boolean);
  return segments.some((segment) => candidates.includes(segment));
}

function hasPrefix(path: string, prefixes: readonly string[]) {
  const lower = normalize(path).toLowerCase();
  return prefixes.some((prefix) => lower.startsWith(prefix));
}

export const ProjectPolicy = {
  classifyPath(path: string): PathExplanation {
    const normalizedPath = normalize(path);
    const categories = this.getCategories(normalizedPath);
    const semanticKinds = this.getSemanticKinds(normalizedPath);
    const reasons: string[] = [];

    const isIgnored = this.isIgnored(normalizedPath);
    const isSensitive = this.isSensitive(normalizedPath);
    const isLowSignalConfig = this.isLowSignalConfig(normalizedPath);
    const isPrimaryEntrypoint = this.isPrimaryEntrypoint(normalizedPath);
    const isPrimaryApiSurface = this.isPrimaryApiSurface(normalizedPath);
    const isArchitectureRelevant = this.isArchitectureRelevant(normalizedPath);
    const isGraphPreviewCandidate = this.isGraphPreviewCandidate(normalizedPath);
    const isRuntimeSource = this.isRuntimeSource(normalizedPath);

    if (isIgnored) reasons.push("ignored-by-policy");
    if (isSensitive) reasons.push("sensitive");
    if (isLowSignalConfig) reasons.push("low-signal-config");
    if (isPrimaryEntrypoint) reasons.push("primary-entrypoint");
    if (isPrimaryApiSurface) reasons.push("api-surface");
    if (isArchitectureRelevant) reasons.push("architecture-relevant");
    if (isGraphPreviewCandidate) reasons.push("graph-preview-candidate");

    return {
      categories,
      groupId: this.deriveGroupId(normalizedPath),
      ignored: isIgnored,
      isApiSurface: isPrimaryApiSurface,
      isArchitectureRelevant: isArchitectureRelevant,
      isEntrypoint: isPrimaryEntrypoint,
      isGraphPreviewCandidate: isGraphPreviewCandidate,
      isLowSignalConfig: isLowSignalConfig,
      isRuntimeSource: isRuntimeSource,
      reasons,
      semanticKinds,
      sensitive: isSensitive,
    };
  },

  deriveGroupId(path: string) {
    const normalized = normalize(path);
    const parts = normalized.split("/").filter(Boolean);
    const lowerParts = normalized.toLowerCase().split("/").filter(Boolean);

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

  filterPrimaryApiSurfacePaths(paths: string[], limit?: number) {
    const deduped = uniq(paths.filter((path) => this.isPrimaryApiSurface(path)));
    return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
  },

  filterPrimaryEntrypointPaths(paths: string[], limit?: number) {
    const deduped = uniq(paths.filter((path) => this.isPrimaryEntrypoint(path)));
    const preferred = deduped.filter((path) => !this.isLikelyBarrelFile(path));
    const output = preferred.length > 0 ? preferred : deduped;
    return typeof limit === "number" ? output.slice(0, limit) : output;
  },

  getCategories(path: string): FileCategory[] {
    const lower = normalize(path).toLowerCase();
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
    const normalized = normalize(groupId);
    if (normalized === "other") return 12;
    if (this.isBroadGenericGroupPath(normalized)) return 10;
    return 0;
  },

  getGroupLabel(groupId: string) {
    const parts = normalize(groupId).split("/").filter(Boolean);
    const raw =
      parts[0] === "src" && (parts[1] === "main" || parts[1] === "test")
        ? parts.slice(-3).join(" / ")
        : parts.slice(-2).join(" / ");
    return raw.replaceAll(/[_-]/g, " ");
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
    const entries = Object.entries(counts) as [ProjectPolicySemanticKind, number][];
    const sorted = orderBy(entries, [(entry) => entry[1], (entry) => entry[0]], ["desc", "asc"]);
    return sorted[0]?.[0] ?? "unknown";
  },

  getSemanticKinds(
    path: string,
    options?: { apiPaths?: ReadonlySet<string> }
  ): ProjectPolicySemanticKind[] {
    const normalized = normalize(path);
    const lower = normalize(path).toLowerCase();
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
      hasPrefix(normalized, PROJECT_POLICY_RULES.semanticPrefixes.frontend) ||
      this.isFrontendComponent(normalized)
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
    const lower = normalize(path).toLowerCase();
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
    return matchers.asset(normalize(path).toLowerCase());
  },

  isBenchmarkFile(path: string) {
    return matchers.benchmark(normalize(path).toLowerCase());
  },

  isBroadGenericGroupPath(groupPath: string) {
    const normalized = normalize(groupPath);
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
    return matchers.config(normalize(path).toLowerCase());
  },

  isDependencyLockfile(path: string) {
    const lower = normalize(path).toLowerCase();
    return PROJECT_POLICY_RULES.fileHints.dependencyLockfiles.some(
      (fileName) => lower === fileName || lower.endsWith(`/${fileName}`)
    );
  },

  isDocsFile(path: string) {
    return matchers.docs(normalize(path).toLowerCase());
  },

  isFrameworkFactSource(path: string) {
    const normalized = normalize(path);
    if (this.isPrimaryContourExcluded(normalized)) return false;
    if (this.isToolingFile(normalized)) return false;
    if (this.isLowSignalConfig(normalized)) return false;
    if (this.isInfraFile(normalized) && !this.isApiPath(normalized)) return false;
    return this.isPrimaryArchitecturePath(normalized) || this.isApiPath(normalized);
  },

  isFrontendComponent(filePath: string): boolean {
    const parts = normalize(filePath).toLowerCase().split("/").filter(Boolean);
    return parts.some((part) => FRONTEND_DIRS_SET.has(part));
  },

  isGeneratedFile(path: string) {
    return matchers.generated(normalize(path).toLowerCase());
  },

  isGraphPreviewCandidate(path: string) {
    const normalized = normalize(path);
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
    return matchers.ignored(normalize(path).toLowerCase());
  },

  isInfraFile(path: string) {
    return matchers.infra(normalize(path).toLowerCase());
  },

  isLikelyBarrelFile(path: string) {
    const lower = normalize(path).toLowerCase();
    if (!/(^|\/)index\.[^/]+$/iu.test(lower)) return false;

    const normalized = lower.startsWith("src/") ? lower.slice(4) : lower;
    const segments = normalized.split("/");

    if (segments.length <= 2) return false;
    if (/^(app|pages|server|cli|bin|scripts)\//iu.test(normalized)) return false;
    if (/(^|\/)(api|routes)\//iu.test(normalized)) return false;

    return true;
  },

  isLowSignalConfig(path: string) {
    const lower = normalize(path).toLowerCase();
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
    const normalized = normalize(path);
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
    const normalized = normalize(path);
    return (
      this.isAssetFile(normalized) ||
      this.isBenchmarkFile(normalized) ||
      this.isDocsFile(normalized) ||
      this.isGeneratedFile(normalized) ||
      this.isTestFile(normalized)
    );
  },

  isPrimaryEntrypoint(path: string) {
    const normalized = normalize(path);
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
      this.isRuntimeSource(normalized) || /(^|\/)(index|main|server|app)\.[^/]+$/iu.test(normalized)
    );
  },

  isRuntimeSource(path: string) {
    const normalized = normalize(path);
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
    return matchers.runtimeSource(normalized.toLowerCase()) || this.isApiPath(normalized);
  },

  isSensitive(path: string) {
    const lower = normalize(path).toLowerCase();
    if (lower.endsWith(".env.example")) return false;
    return matchers.sensitive(lower);
  },

  isStructureCandidate(path: string) {
    const normalized = normalize(path);
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
    return matchers.test(normalize(path).toLowerCase());
  },

  isToolingFile(path: string) {
    return matchers.tooling(normalize(path).toLowerCase());
  },

  isUsefulComplexityCandidate(path: string) {
    const normalized = normalize(path);
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
