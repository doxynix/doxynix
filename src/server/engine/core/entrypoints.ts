import pm from "picomatch";

import { FileClassifier } from "./file-classifier";
import { PATH_PATTERNS } from "./patterns";
import type { RepositoryFile } from "./types";

const isEntry = pm([...PATH_PATTERNS.ENTRY, ...PATH_PATTERNS.INFRA_DIRS]);

export function getLikelyEntrypoints(
  files: RepositoryFile[],
  inboundByFile: Map<string, number>,
  apiSurfaceByFile: Map<string, number>,
  entrypointHints: Set<string>
) {
  const discovered = new Set<string>(entrypointHints);

  for (const file of files) {
    const path = file.path;
    if (FileClassifier.isPrimaryContourExcluded(path)) continue;
    if (FileClassifier.isConfigFile(path)) continue;

    const inbound = inboundByFile.get(path) ?? 0;

    if (isEntry(path)) {
      if (FileClassifier.isPrimaryEntrypointFile(path)) discovered.add(path);
      continue;
    }

    if (
      (apiSurfaceByFile.get(path) ?? 0) > 0 &&
      inbound === 0 &&
      FileClassifier.isPrimaryEntrypointFile(path)
    ) {
      discovered.add(path);
      continue;
    }

    if (
      inbound === 0 &&
      (path.includes("/api/") || path.includes("/server/")) &&
      FileClassifier.isPrimaryEntrypointFile(path)
    ) {
      discovered.add(path);
    }
  }

  return Array.from(discovered).sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );
}
