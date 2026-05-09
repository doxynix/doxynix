import { basename } from "pathe";

import { appLogger } from "@/server/shared/infrastructure/app-logger";

import { getLanguageAdapters } from "../adapters/registry";
import { normalizeRepoPath } from "../core/common";
import type { FileSignals, RepositoryFile } from "../core/discovery.types";
import { ProjectPolicy } from "../core/project-policy";
import { collectRegexSignals } from "./regex-signals";

export async function collectPolyglotSignals(file: RepositoryFile): Promise<FileSignals> {
  const normalizedPath = normalizeRepoPath(file.path);
  const normalizedFile = { ...file, path: normalizedPath };

  const pathDetails = ProjectPolicy.classifyPath(normalizedPath);

  const configRefs =
    pathDetails.isLowSignalConfig || pathDetails.categories.includes("config")
      ? [
          {
            confidence: 90,
            kind: basename(normalizedPath),
            path: normalizedPath,
          },
        ]
      : [];

  const adapters = getLanguageAdapters(normalizedFile);

  for (const adapter of adapters) {
    try {
      const signals = await adapter.parse(normalizedFile);
      if (signals == null) continue;

      return {
        ...signals,
        categories: pathDetails.categories,
        configRefs,
      };
    } catch (error) {
      appLogger.debug({
        adapter: adapter.constructor.name,
        error,
        msg: "Language adapter failed, trying next parser",
        path: normalizedPath,
      });
    }
  }

  return {
    ...collectRegexSignals(normalizedFile),
    categories: pathDetails.categories,
    configRefs,
  };
}
