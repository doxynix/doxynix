import path from "node:path";
import pm from "picomatch";

import { normalizeLanguageName } from "@/shared/lib/utils";

import { PATH_PATTERNS } from "./patterns";
import type { FileCategory } from "./types";

function compileMatcher(patterns: string | string[]) {
  const values = Array.isArray(patterns) ? patterns : [patterns];
  return pm(values.map((pattern) => pattern.toLowerCase()));
}

const isApi = compileMatcher(PATH_PATTERNS.API);
const isAsset = compileMatcher(PATH_PATTERNS.ASSET);
const isBenchmark = compileMatcher(PATH_PATTERNS.BENCHMARK);
const isConfig = compileMatcher(PATH_PATTERNS.CONFIG);
const isDocs = compileMatcher(PATH_PATTERNS.DOCS);
const isGenerated = compileMatcher(PATH_PATTERNS.GENERATED);
const isInfra = compileMatcher([...PATH_PATTERNS.INFRA, ...PATH_PATTERNS.INFRA_DIRS]);
const isTest = compileMatcher(PATH_PATTERNS.TEST);
const isIgnored = compileMatcher(PATH_PATTERNS.IGNORE);
const isSensitive = compileMatcher(PATH_PATTERNS.SENSITIVE);
const isTooling = compileMatcher(PATH_PATTERNS.TOOLING);
const isRuntimeSource = compileMatcher(PATH_PATTERNS.RUNTIME_SOURCE);

export class FileClassifier {
  static isPrimaryContourExcluded(path: string): boolean {
    const lower = path.toLowerCase();
    return (
      this.isAssetFile(lower) ||
      this.isBenchmarkFile(lower) ||
      this.isDocsFile(lower) ||
      this.isGeneratedFile(lower) ||
      this.isTestFile(lower)
    );
  }

  static isSensitiveFile(path: string): boolean {
    const lower = path.toLowerCase();
    if (lower.endsWith(".env.example")) return false;
    return isSensitive(lower);
  }

  static isConfigFile(path: string): boolean {
    return isConfig(path.toLowerCase());
  }

  static isApiFile(path: string): boolean {
    const lower = path.toLowerCase();
    if (this.isTestFile(lower)) return false;
    return isApi(lower);
  }

  static isIgnored(path: string): boolean {
    return isIgnored(path.toLowerCase());
  }

  static isTestFile(path: string): boolean {
    return isTest(path.toLowerCase());
  }

  static isBenchmarkFile(path: string) {
    return isBenchmark(path.toLowerCase());
  }

  static isDocsFile(path: string) {
    return isDocs(path.toLowerCase());
  }

  static isGeneratedFile(path: string) {
    return isGenerated(path.toLowerCase());
  }

  static isInfraFile(path: string) {
    return isInfra(path.toLowerCase());
  }

  static isAssetFile(path: string) {
    return isAsset(path.toLowerCase());
  }

  static isToolingFile(path: string) {
    return isTooling(path.toLowerCase());
  }

  static isRuntimeSourceFile(path: string) {
    const lower = path.toLowerCase();
    if (
      this.isAssetFile(lower) ||
      this.isBenchmarkFile(lower) ||
      this.isConfigFile(lower) ||
      this.isDocsFile(lower) ||
      this.isGeneratedFile(lower) ||
      this.isTestFile(lower) ||
      this.isToolingFile(lower)
    ) {
      return false;
    }
    return isRuntimeSource(lower) || this.isApiFile(lower);
  }

  static getCategories(path: string): FileCategory[] {
    const lower = path.toLowerCase();
    const categories = new Set<FileCategory>();

    if (this.isAssetFile(lower)) categories.add("asset");
    if (this.isBenchmarkFile(lower)) categories.add("benchmark");
    if (this.isConfigFile(lower)) categories.add("config");
    if (this.isDocsFile(lower)) categories.add("docs");
    if (this.isGeneratedFile(lower)) categories.add("generated");
    if (this.isInfraFile(lower)) categories.add("infra");
    if (this.isTestFile(lower)) categories.add("test");
    if (this.isToolingFile(lower)) categories.add("tooling");
    if (
      this.isRuntimeSourceFile(lower) ||
      (categories.size === 0 && !this.isIgnored(lower) && !this.isSensitiveFile(lower))
    ) {
      categories.add("runtime-source");
    }

    return Array.from(categories);
  }

  static getPrimaryCategory(path: string): FileCategory {
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
  }

  static isArchitectureRelevant(path: string) {
    const categories = this.getCategories(path);
    return (
      categories.includes("runtime-source") &&
      !categories.some((category) =>
        ["asset", "benchmark", "config", "docs", "generated", "test"].includes(category)
      )
    );
  }

  static isPrimaryArchitectureFile(path: string) {
    return this.isArchitectureRelevant(path) && !this.isSecondaryEvidenceFile(path);
  }

  static isSecondaryEvidenceFile(path: string) {
    const categories = this.getCategories(path);
    return (
      categories.length === 0 ||
      categories.some((category) =>
        ["asset", "benchmark", "config", "docs", "generated", "infra", "test", "tooling"].includes(
          category
        )
      )
    );
  }

  static isPrimaryEntrypointFile(path: string) {
    const lower = path.toLowerCase();
    if (this.isPrimaryContourExcluded(lower)) return false;
    if (this.isConfigFile(lower) || this.isInfraFile(lower) || this.isToolingFile(lower))
      return false;
    return this.isRuntimeSourceFile(lower) || /(^|\/)(index|main|server|app)\.[^/]+$/iu.test(lower);
  }

  static isPrimaryApiEvidenceFile(path: string) {
    const lower = path.toLowerCase();
    if (this.isPrimaryContourExcluded(lower)) return false;
    if (this.isConfigFile(lower) || this.isToolingFile(lower)) return false;
    if (this.isInfraFile(lower) && !this.isApiFile(lower)) return false;
    return this.isApiFile(lower) || this.isPrimaryArchitectureFile(lower);
  }

  static isCoreFrameworkFactSource(path: string) {
    const lower = path.toLowerCase();
    if (this.isPrimaryContourExcluded(lower)) return false;
    if (this.isToolingFile(lower)) return false;
    if (this.isInfraFile(lower) && !this.isApiFile(lower)) return false;
    return this.isPrimaryArchitectureFile(lower) || this.isApiFile(lower);
  }

  static filterPrimaryEntrypointPaths(paths: string[], limit?: number) {
    const deduped = Array.from(new Set(paths.filter((path) => this.isPrimaryEntrypointFile(path))));
    return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
  }

  static filterPrimaryApiEvidencePaths(paths: string[], limit?: number) {
    const deduped = Array.from(
      new Set(paths.filter((path) => this.isPrimaryApiEvidenceFile(path)))
    );
    return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
  }

  static getScore(path: string): number {
    const lower = path.toLowerCase();

    if (this.isSensitiveFile(lower)) return 0;
    if (this.isGeneratedFile(lower) || this.isAssetFile(lower)) return 5;
    if (this.isDocsFile(lower)) return 10;
    if (this.isBenchmarkFile(lower)) return 15;
    if (this.isTestFile(lower)) return 20;
    if (this.isInfraFile(lower)) return 30;
    if (this.isToolingFile(lower)) return 40;
    if (this.isConfigFile(lower)) return 85;
    if (this.isApiFile(lower)) return 90;
    if (this.isRuntimeSourceFile(lower)) return 80;

    if (lower.includes("/ui/") || lower.includes("/components/")) return 40;

    const depth = path.split("/").length;
    let score = 50;
    if (depth < 3) score += 10;

    return score;
  }
}

export function linguistStyleLabel(filePath: string, fallbackName: string): string {
  const ext = path.posix.extname(filePath);
  return normalizeLanguageName(ext) || fallbackName;
}
