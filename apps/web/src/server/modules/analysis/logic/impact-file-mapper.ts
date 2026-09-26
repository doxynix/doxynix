import { normalize } from "pathe";

import type { PRChangedFileSnapshot } from "@/server/utils/types";

import { analysisMapper, type TopLevelImpactNode } from "../analysis.mapper";
import type { createAnalyzeContextBuilder } from "./analyze-context-builder";
import { makeStructureNodeId } from "./structure-shared";

type AnalyzeContext = ReturnType<typeof createAnalyzeContextBuilder>;

export type ChangedFileImpact = PRChangedFileSnapshot & {
  filePath: string;
  findingCount: number;
  nodeId: null | string;
  nodeLabel: null | string;
  previousFilePath: null | string;
  targetView: "code" | "map";
  zoneId: null | string;
  zoneLabel: null | string;
};

/**
 * Resolves each changed file to the architecture node a reviewer should land on.
 *
 * A file that the structure context already tracks becomes a `file:` node and
 * opens the code view; anything else falls back to its containing top-level
 * zone (`group:`) and opens the map. `nodeDetailCache` is shared with the
 * caller so repeated resolutions of the same node do not re-parse the snapshot.
 */
export function mapChangedFilesToImpactNodes(params: {
  analyzeContext: AnalyzeContext;
  changedFiles: PRChangedFileSnapshot[];
  findingsByFile: Map<string, number>;
  interestingPaths: Set<string>;
  nodeById: Map<string, TopLevelImpactNode>;
  nodeDetailCache: Map<string, ReturnType<AnalyzeContext["getStructureNode"]>>;
}): ChangedFileImpact[] {
  const {
    analyzeContext,
    changedFiles,
    findingsByFile,
    interestingPaths,
    nodeById,
    nodeDetailCache,
  } = params;

  return changedFiles.map((file) => {
    const normalizedFilePath = normalize(file.filePath);
    const normalizedPreviousPath =
      file.previousFilePath == null ? null : normalize(file.previousFilePath);

    const directNodeId = interestingPaths.has(normalizedFilePath)
      ? makeStructureNodeId("file", normalizedFilePath)
      : null;
    const zoneNode = analysisMapper.matchTopLevelZone(
      [...nodeById.values()],
      normalizedFilePath,
      normalizedPreviousPath,
    );
    const matchedNodeId = directNodeId ?? zoneNode?.id ?? null;
    const matchedNode =
      matchedNodeId == null
        ? null
        : analysisMapper.resolveMatchedNode(
            matchedNodeId,
            analyzeContext,
            nodeById,
            nodeDetailCache,
          );

    return {
      ...file,
      filePath: normalizedFilePath,
      findingCount: findingsByFile.get(normalizedFilePath) ?? 0,
      nodeId: matchedNodeId,
      nodeLabel: matchedNode?.label ?? null,
      previousFilePath: normalizedPreviousPath,
      targetView: directNodeId != null ? ("code" as const) : ("map" as const),
      zoneId: zoneNode?.id ?? null,
      zoneLabel: zoneNode?.label ?? null,
    };
  });
}
