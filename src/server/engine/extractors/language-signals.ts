import path from "node:path";

import { getLanguageAdapters } from "../adapters/registry";
import { normalizeRepoPath } from "../core/common";
import { FileClassifier } from "../core/file-classifier";
import type { FileSignals, RepositoryFile } from "../core/types";
import { collectRegexSignals } from "./regex-signals";

export async function collectPolyglotSignals(file: RepositoryFile): Promise<FileSignals> {
  const normalizedPath = normalizeRepoPath(file.path);
  const normalizedFile = { ...file, path: normalizedPath };
  const adapters = getLanguageAdapters(normalizedFile);

  for (const adapter of adapters) {
    try {
      const signals = await adapter.parse(normalizedFile);
      if (signals == null) continue;
      return {
        ...signals,
        categories: FileClassifier.getCategories(normalizedPath),
        configRefs: FileClassifier.isConfigFile(normalizedPath)
          ? [{ confidence: 90, kind: path.posix.basename(normalizedPath), path: normalizedPath }]
          : [],
      };
    } catch {
      // Try the next adapter in the cascade.
    }
  }

  return {
    ...collectRegexSignals(normalizedFile),
    categories: FileClassifier.getCategories(normalizedPath),
    configRefs: FileClassifier.isConfigFile(normalizedPath)
      ? [{ confidence: 90, kind: path.posix.basename(normalizedPath), path: normalizedPath }]
      : [],
  };
}
