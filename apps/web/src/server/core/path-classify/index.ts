import { normalize } from "pathe";
import pm from "picomatch";

import {
  dependencyLockfiles,
  frontendDirectories,
  lowSignalConfigNames,
  PATH_PATTERNS,
} from "./patterns";

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
  infra: compileMatcher(PATH_PATTERNS.INFRA),
  runtimeSource: compileMatcher(PATH_PATTERNS.RUNTIME_SOURCE),
  sensitive: compileMatcher(PATH_PATTERNS.SENSITIVE),
  test: compileMatcher(PATH_PATTERNS.TEST),
  tooling: compileMatcher(PATH_PATTERNS.TOOLING),
};

const FRONTEND_DIRS_SET = new Set<string>(frontendDirectories);

const lower = (path: string): string => normalize(path).toLowerCase();

export function isApiPath(path: string): boolean {
  const value = lower(path);
  if (isTestFile(value)) {
    return false;
  }
  return matchers.api(value);
}

export function isAssetFile(path: string): boolean {
  return matchers.asset(lower(path));
}

export function isBenchmarkFile(path: string): boolean {
  return matchers.benchmark(lower(path));
}

export function isConfigFile(path: string): boolean {
  return matchers.config(lower(path));
}

export function isDependencyLockfile(path: string): boolean {
  const value = lower(path);
  return dependencyLockfiles.some(
    (fileName) => value === fileName || value.endsWith(`/${fileName}`),
  );
}

export function isDocsFile(path: string): boolean {
  return matchers.docs(lower(path));
}

export function isFrontendComponent(filePath: string): boolean {
  return lower(filePath)
    .split("/")
    .filter(Boolean)
    .some((part) => FRONTEND_DIRS_SET.has(part));
}

export function isGeneratedFile(path: string): boolean {
  return matchers.generated(lower(path));
}

export function isInfraFile(path: string): boolean {
  return matchers.infra(lower(path));
}

export function isLowSignalConfig(path: string): boolean {
  const value = lower(path);
  if (isDependencyLockfile(value)) {
    return true;
  }
  if (/^prisma\/migrations\/[^/]+\/migration\.sql$/u.test(value)) {
    return true;
  }
  if (
    lowSignalConfigNames.some((fileName) => value === fileName || value.endsWith(`/${fileName}`))
  ) {
    return true;
  }
  return /[.-](min)\.(js|cjs|mjs|css)$/iu.test(value);
}

export function isRuntimeSource(path: string): boolean {
  const value = lower(path);
  if (
    isAssetFile(value) ||
    isBenchmarkFile(value) ||
    isConfigFile(value) ||
    isDocsFile(value) ||
    isGeneratedFile(value) ||
    isTestFile(value) ||
    isToolingFile(value)
  ) {
    return false;
  }
  return matchers.runtimeSource(value) || isApiPath(value);
}

export function isSensitive(path: string): boolean {
  const value = lower(path);
  if (value.endsWith(".env.example")) {
    return false;
  }
  return matchers.sensitive(value);
}

export function isTestFile(path: string): boolean {
  return matchers.test(lower(path));
}

export function isToolingFile(path: string): boolean {
  return matchers.tooling(lower(path));
}
