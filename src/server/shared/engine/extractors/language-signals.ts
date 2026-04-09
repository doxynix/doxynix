import { logger } from "@/server/shared/infrastructure/logger";

import { getLanguageAdapters } from "../adapters/registry";
import { normalizeRepoPath } from "../core/common";
import type { FileSignals, RepositoryFile } from "../core/discovery.types";
import { ProjectPolicy } from "../core/project-policy";
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
        categories: ProjectPolicy.getCategories(normalizedPath),
        configRefs: ProjectPolicy.isConfigFile(normalizedPath)
          ? [
              {
                confidence: 90,
                kind: normalizedPath.split("/").pop() ?? normalizedPath,
                path: normalizedPath,
              },
            ]
          : [],
      };
    } catch (error) {
      logger.debug({
        adapter: adapter.constructor.name,
        error,
        msg: "Language adapter failed, trying next parser",
        path: normalizedPath,
      });
    }
  }

  return {
    ...collectRegexSignals(normalizedFile),
    categories: ProjectPolicy.getCategories(normalizedPath),
    configRefs: ProjectPolicy.isConfigFile(normalizedPath)
      ? [
          {
            confidence: 90,
            kind: normalizedPath.split("/").pop() ?? normalizedPath,
            path: normalizedPath,
          },
        ]
      : [],
  };
}
