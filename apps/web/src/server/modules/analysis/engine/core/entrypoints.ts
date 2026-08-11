import type { RepositoryFile } from "./discovery.types";
import { ProjectPolicy } from "./project-policy";

/**
 * Вычисляет вероятные точки входа (entrypoints) в анализируемую кодовую базу.
 * Опирается на маски файлов, семантику папок и граф связей (отсутствие входящих импортов).
 */
export function getLikelyEntrypoints(
  files: RepositoryFile[],
  inboundByFile: Map<string, number>,
  apiSurfaceByFile: Map<string, number>,
  entrypointHints: Set<string>
): string[] {
  const discovered = new Set<string>(
    Array.from(entrypointHints).filter(
      (path) => !ProjectPolicy.isPrimaryContourExcluded(path) && !ProjectPolicy.isConfigFile(path)
    )
  );

  for (const file of files) {
    const path = file.path;

    if (ProjectPolicy.isPrimaryContourExcluded(path)) continue;
    if (ProjectPolicy.isConfigFile(path)) continue;

    const inbound = inboundByFile.get(path) ?? 0;
    const isPrimary = ProjectPolicy.isPrimaryEntrypoint(path);

    if (isPrimary) {
      discovered.add(path);
      continue;
    }

    const apiOperations = apiSurfaceByFile.get(path) ?? 0;
    if (apiOperations > 0 && inbound === 0) {
      discovered.add(path);
      continue;
    }

    if (inbound === 0) {
      const isApiOrBackend =
        ProjectPolicy.isApiPath(path) || ProjectPolicy.isFrontendComponent(path);
      if (isApiOrBackend) {
        discovered.add(path);
      }
    }
  }

  return Array.from(discovered).sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );
}
