import pm from "picomatch";

import type { RepositoryFile } from "./discovery.types";
import { ProjectPolicy } from "./project-policy";
import { PATH_PATTERNS } from "./project-policy-rules";

const isEntry = pm([...PATH_PATTERNS.ENTRY, ...PATH_PATTERNS.INFRA_DIRS]);

export function getLikelyEntrypoints(
  files: RepositoryFile[],
  inboundByFile: Map<string, number>,
  apiSurfaceByFile: Map<string, number>,
  entrypointHints: Set<string>
) {
  const discovered = new Set<string>(
    [...entrypointHints].filter(
      (path) => !ProjectPolicy.isPrimaryContourExcluded(path) && !ProjectPolicy.isConfigFile(path)
    )
  );

  for (const file of files) {
    const path = file.path;
    if (ProjectPolicy.isPrimaryContourExcluded(path)) continue;
    if (ProjectPolicy.isConfigFile(path)) continue;

    const inbound = inboundByFile.get(path) ?? 0;

    if (isEntry(path)) {
      if (ProjectPolicy.isPrimaryEntrypoint(path)) discovered.add(path);
      continue;
    }

    if (
      (apiSurfaceByFile.get(path) ?? 0) > 0 &&
      inbound === 0 &&
      ProjectPolicy.isPrimaryEntrypoint(path)
    ) {
      discovered.add(path);
      continue;
    }

    if (
      inbound === 0 &&
      (Boolean(path.includes("/api/")) || Boolean(path.includes("/server/"))) &&
      ProjectPolicy.isPrimaryEntrypoint(path)
    ) {
      discovered.add(path);
    }
  }

  return Array.from(discovered).sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );
}
