import { unstable_cache } from "next/cache";
import { sumBy } from "es-toolkit";
import { z } from "zod";

import { createAnalyzeContextBuilder } from "@/server/entities/analyze/lib/analyze-context-builder";
import { buildTopLevelNodes } from "@/server/entities/analyze/lib/graph-navigator";
import {
  isPathInsideScope,
  makeStructureNodeId,
} from "@/server/entities/analyze/lib/structure-shared";
import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import type { DbClient } from "@/server/shared/infrastructure/db";
import { getRepoWithLatestAnalysisAndDocs } from "@/server/shared/infrastructure/repo-snapshots";
import { markdownToHtml } from "@/server/shared/lib/markdown-to-html";
import type { PRChangedFileSnapshot, PRImpactPayload } from "@/server/shared/types";

const changedFileSnapshotSchema = z.object({
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  filePath: z.string().min(1),
  previousFilePath: z.string().min(1).nullable().optional(),
  status: z.enum(["added", "modified", "removed", "renamed"]),
});

const persistedFindingSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().min(1),
  message: z.string().min(1),
  score: z.number().int().min(0).optional(),
  title: z.string().min(1),
  type: z.string().min(1),
});

type ImpactAnalysisRecord = Awaited<ReturnType<typeof loadImpactAnalysis>>;
type ImpactAnalysis = NonNullable<ImpactAnalysisRecord>;
type ParsedFinding = z.infer<typeof persistedFindingSchema>;
type TopLevelImpactNode = {
  id: string;
  kind: string;
  label: string;
  nodeType: "file" | "group";
  path: string;
};

export const prImpactService = {
  async getByRepoAndPRNumber(db: DbClient, repoId: string, prNumber: number) {
    const analysis = await loadImpactAnalysis(db, repoId, prNumber);
    if (analysis == null) return null;

    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);
    const changedFiles = parseChangedFilesSnapshot(analysis);
    const findings = parsePersistedFindings(analysis);

    if (repo == null) {
      return null;
    }

    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structureContext = analyzeContext.getStructureContext();
    const topLevelNodes = structureContext == null ? [] : buildTopLevelNodes(structureContext);
    const interestingPaths = new Set(structureContext?.allInterestingPaths ?? []);
    const nodeById = new Map(topLevelNodes.map((node) => [node.id, node] as const));
    const nodeDetailCache = new Map<string, ReturnType<typeof analyzeContext.getStructureNode>>();
    const findingsByFile = countFindingsByFile(findings);

    const changedFileItems = changedFiles.map((file) => {
      const normalizedFilePath = normalizeRepoPath(file.filePath);
      const normalizedPreviousPath =
        file.previousFilePath == null ? null : normalizeRepoPath(file.previousFilePath);
      const directNodeId = interestingPaths.has(normalizedFilePath)
        ? makeStructureNodeId("file", normalizedFilePath)
        : null;
      const zoneNode = matchTopLevelZone(topLevelNodes, normalizedFilePath, normalizedPreviousPath);
      const matchedNodeId = directNodeId ?? zoneNode?.id ?? null;
      const matchedNode =
        matchedNodeId == null
          ? null
          : resolveMatchedNode(matchedNodeId, analyzeContext, nodeById, nodeDetailCache);
      const findingCount = findingsByFile.get(normalizedFilePath) ?? 0;

      return {
        ...file,
        filePath: normalizedFilePath,
        findingCount,
        nodeId: matchedNodeId,
        nodeLabel: matchedNode?.label ?? null,
        previousFilePath: normalizedPreviousPath,
        targetView: directNodeId != null ? ("code" as const) : ("map" as const),
        zoneId: zoneNode?.id ?? null,
        zoneLabel: zoneNode?.label ?? null,
      };
    });

    const affectedZones = buildAffectedZones(changedFileItems, findings, nodeById);
    const affectedNodes = buildAffectedNodes(
      changedFileItems,
      findings,
      analyzeContext,
      nodeById,
      nodeDetailCache
    );
    const topFindings = await buildTopFindings(findings, changedFileItems, nodeById);
    const primaryFile = selectPrimaryFile(changedFileItems);
    const primaryNodeId =
      primaryFile?.nodeId ?? affectedNodes[0]?.nodeId ?? affectedZones[0]?.nodeId ?? null;

    return {
      affectedNodes,
      affectedZones,
      analysis: {
        baseSha: analysis.baseSha,
        createdAt: analysis.createdAt,
        headSha: analysis.headSha,
        id: analysis.publicId,
        prNumber: analysis.prNumber,
        riskScore: analysis.riskScore,
        status: analysis.status,
      },
      changedFiles: changedFileItems,
      fixes: analysis.generatedFixes.map((fix) => ({
        githubPrNumber: fix.githubPrNumber,
        githubPrUrl: fix.githubPrUrl,
        id: fix.publicId,
        status: fix.status,
        title: fix.title,
      })),
      navigationHints: {
        primaryFilePath: primaryFile?.filePath ?? null,
        primaryNodeId,
        recommendedView:
          primaryNodeId?.startsWith("group:") === true
            ? "map"
            : primaryFile?.nodeId != null
              ? "code"
              : "map",
      },
      summary: {
        affectedFiles: changedFileItems.length,
        affectedNodes: affectedNodes.length,
        affectedZones: affectedZones.length,
        findings: findings.length,
        linkedFixes: analysis.generatedFixes.length,
      },
      topFindings,
    } satisfies PRImpactPayload;
  },
};

async function loadImpactAnalysis(db: DbClient, repoId: string, prNumber: number) {
  return db.pullRequestAnalysis.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      baseSha: true,
      changedFilesJson: true,
      comments: {
        orderBy: [{ riskLevel: "desc" }, { filePath: "asc" }, { line: "asc" }],
        select: {
          body: true,
          filePath: true,
          findingType: true,
          line: true,
          publicId: true,
          riskLevel: true,
        },
      },
      createdAt: true,
      findingsJson: true,
      generatedFixes: {
        orderBy: { createdAt: "desc" },
        select: {
          githubPrNumber: true,
          githubPrUrl: true,
          publicId: true,
          status: true,
          title: true,
        },
      },
      headSha: true,
      prNumber: true,
      publicId: true,
      riskScore: true,
      status: true,
    },
    where: {
      prNumber,
      repo: { publicId: repoId },
    },
  });
}

function parseChangedFilesSnapshot(analysis: ImpactAnalysis): PRChangedFileSnapshot[] {
  const parsed = z.array(changedFileSnapshotSchema).safeParse(analysis.changedFilesJson);
  if (parsed.success) {
    return parsed.data.map((file) => ({
      additions: file.additions,
      deletions: file.deletions,
      filePath: normalizeRepoPath(file.filePath),
      previousFilePath:
        file.previousFilePath == null ? null : normalizeRepoPath(file.previousFilePath),
      status: file.status,
    }));
  }

  const legacyPaths = new Set<string>();
  for (const comment of analysis.comments) legacyPaths.add(normalizeRepoPath(comment.filePath));

  const findings = parsePersistedFindings(analysis);
  for (const finding of findings) legacyPaths.add(normalizeRepoPath(finding.file));

  return [...legacyPaths].map((filePath) => ({
    additions: 0,
    deletions: 0,
    filePath,
    previousFilePath: null,
    status: "modified" as const,
  }));
}

function parsePersistedFindings(analysis: ImpactAnalysis): ParsedFinding[] {
  const parsed = z.array(persistedFindingSchema).safeParse(analysis.findingsJson);
  if (parsed.success) {
    return parsed.data.map((finding) => ({
      ...finding,
      file: normalizeRepoPath(finding.file),
    }));
  }

  return analysis.comments.map((comment) => ({
    file: normalizeRepoPath(comment.filePath),
    line: comment.line,
    message: comment.body,
    score: comment.riskLevel,
    title: comment.findingType,
    type: comment.findingType,
  }));
}

function countFindingsByFile(findings: ParsedFinding[]) {
  const countByFile = new Map<string, number>();

  for (const finding of findings) {
    const nextCount = (countByFile.get(finding.file) ?? 0) + 1;
    countByFile.set(finding.file, nextCount);
  }

  return countByFile;
}

function matchTopLevelZone<TNode extends { id: string; label: string; path: string }>(
  topLevelNodes: TNode[],
  filePath: string,
  previousFilePath: null | string
) {
  const matchPath = (path: string) =>
    topLevelNodes
      .filter((node) => isPathInsideScope(path, node.path))
      .toSorted((left, right) => right.path.length - left.path.length)[0] ?? null;

  return matchPath(filePath) ?? (previousFilePath == null ? null : matchPath(previousFilePath));
}

function resolveMatchedNode(
  nodeId: string,
  analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>,
  topLevelNodeById: Map<string, TopLevelImpactNode>,
  nodeDetailCache: Map<string, ReturnType<typeof analyzeContext.getStructureNode>>
) {
  if (nodeId.startsWith("group:")) {
    const node = topLevelNodeById.get(nodeId);
    return node == null ? null : { ...node, markers: null };
  }

  if (!nodeDetailCache.has(nodeId)) {
    nodeDetailCache.set(nodeId, analyzeContext.getStructureNode(nodeId));
  }

  const detail = nodeDetailCache.get(nodeId);
  if (detail == null) return null;

  return detail.node;
}

function buildAffectedZones(
  changedFiles: Array<PRImpactPayload["changedFiles"][number]>,
  findings: ParsedFinding[],
  zoneNodeById: Map<string, TopLevelImpactNode>
) {
  const findingsByFile = countFindingsByFile(findings);
  const grouped = new Map<string, typeof changedFiles>();

  for (const file of changedFiles) {
    if (file.zoneId == null) continue;
    const items = grouped.get(file.zoneId) ?? [];
    items.push(file);
    grouped.set(file.zoneId, items);
  }

  return [...grouped.entries()]
    .map(([zoneId, files]) => {
      const zone = zoneNodeById.get(zoneId);
      if (zone == null) return null;

      const findingCount = sumBy(files, (file) => findingsByFile.get(file.filePath) ?? 0);
      return {
        fileCount: files.length,
        findingCount,
        impactScore: computeImpactScore(files, findingCount, {
          api: zone.kind === "api",
          entrypoint: false,
          risk: files.some((file) => file.findingCount > 0),
        }),
        kind: zone.kind,
        label: zone.label,
        nodeId: zone.id,
        path: zone.path,
        relatedChangedFiles: files.map((file) => file.filePath),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .toSorted(
      (left, right) => right.impactScore - left.impactScore || left.label.localeCompare(right.label)
    );
}

function buildAffectedNodes(
  changedFiles: Array<PRImpactPayload["changedFiles"][number]>,
  findings: ParsedFinding[],
  analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>,
  topLevelNodeById: Map<string, TopLevelImpactNode>,
  nodeDetailCache: Map<string, ReturnType<typeof analyzeContext.getStructureNode>>
) {
  const grouped = new Map<string, typeof changedFiles>();

  for (const file of changedFiles) {
    if (file.nodeId == null) continue;
    const items = grouped.get(file.nodeId) ?? [];
    items.push(file);
    grouped.set(file.nodeId, items);
  }

  return [...grouped.entries()]
    .map(([nodeId, files]) => {
      const matchedNode = resolveMatchedNode(
        nodeId,
        analyzeContext,
        topLevelNodeById,
        nodeDetailCache
      );
      if (matchedNode == null) return null;

      const relatedFindings = findings.filter((finding) =>
        files.some((file) => file.filePath === finding.file)
      );
      const findingCount = relatedFindings.length;
      const impactScore = computeImpactScore(
        files,
        findingCount,
        matchedNode.markers ?? {
          api: matchedNode.kind === "api",
          entrypoint: false,
          risk: findingCount > 0,
        }
      );

      return {
        fileCount: files.length,
        findingCount,
        impactScore,
        kind: matchedNode.kind,
        label: matchedNode.label,
        nodeId,
        nodeType: matchedNode.nodeType,
        path: matchedNode.path,
        relatedChangedFiles: files.map((file) => file.filePath),
        whyAffected: `${files.length} changed file(s) and ${findingCount} linked finding(s) touch this node.`,
        zoneId: files[0]?.zoneId ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .toSorted(
      (left, right) => right.impactScore - left.impactScore || left.label.localeCompare(right.label)
    );
}

async function buildTopFindings(
  findings: ParsedFinding[],
  changedFiles: Array<PRImpactPayload["changedFiles"][number]>,
  zoneNodeById: Map<string, Pick<TopLevelImpactNode, "label">>
) {
  const fileByPath = new Map(changedFiles.map((file) => [file.filePath, file] as const));

  const sortedFindings = findings
    .map((finding, index) => {
      const file = fileByPath.get(finding.file);
      return {
        filePath: finding.file,
        findingType: finding.type,
        id: `${finding.file}:${finding.line}:${finding.type}:${index}`,
        line: finding.line,
        message: finding.message,
        nodeId: file?.nodeId ?? null,
        riskLevel: finding.score ?? 0,
        title: finding.title,
        zoneId: file?.zoneId ?? null,
        zoneLabel:
          file?.zoneId == null ? null : (zoneNodeById.get(file.zoneId)?.label ?? file.zoneLabel),
      };
    })
    .toSorted(
      (left, right) =>
        right.riskLevel - left.riskLevel || left.filePath.localeCompare(right.filePath)
    );

  return await Promise.all(
    sortedFindings.map(async (finding) => {
      const messageHtml = await unstable_cache(
        async () => markdownToHtml(finding.message),
        [`finding-html-${finding.id}`],
        {
          revalidate: false,
          tags: ["findings", finding.id],
        }
      )();

      return {
        ...finding,
        messageHtml,
      };
    })
  );
}

function selectPrimaryFile(changedFiles: Array<PRImpactPayload["changedFiles"][number]>) {
  return (
    changedFiles.toSorted((left, right) => {
      const leftScore = left.findingCount * 20 + left.additions + left.deletions;
      const rightScore = right.findingCount * 20 + right.additions + right.deletions;
      return rightScore - leftScore || left.filePath.localeCompare(right.filePath);
    })[0] ?? null
  );
}

function computeImpactScore(
  files: Array<Pick<PRChangedFileSnapshot, "additions" | "deletions">>,
  findingCount: number,
  markers: { api: boolean; entrypoint: boolean; risk: boolean }
) {
  const changeIntensity = sumBy(files, (file) =>
    Math.min(18, Math.ceil((file.additions + file.deletions) / 20))
  );
  const findingBoost = findingCount * 12;
  const markerBoost =
    (markers.entrypoint ? 12 : 0) + (markers.api ? 10 : 0) + (markers.risk ? 6 : 0);

  return Math.min(100, changeIntensity + findingBoost + markerBoost);
}
