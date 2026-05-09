import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { orderBy, uniqBy } from "es-toolkit";
import { basename } from "pathe";

import { DocumentFormatter } from "@/server/features/analyze-repo/lib/section-graph-linker";
import type { DbClient } from "@/server/shared/infrastructure/db";
import { getRepoWithLatestAnalysisAndDocs } from "@/server/shared/infrastructure/repo-snapshots";
import { unique } from "@/server/shared/lib/array-utils";
import type { RepoSearchResult } from "@/server/shared/types";

import type { ExplainPayload, StructureNodePayload } from "../api/repo-details.presenter";
import { createAnalyzeContextBuilder } from "../lib/analyze-context-builder";

export async function loadRepoOrThrow(db: DbClient, repoId: string, aid?: string) {
  const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId, aid);
  if (repo == null)
    throw new TRPCError({ code: "NOT_FOUND", message: "Repository or Analysis version not found" });
  return repo;
}

export async function loadAnalyzeContextBuilderOrThrow(db: DbClient, repoId: string, aid?: string) {
  return createAnalyzeContextBuilder(await loadRepoOrThrow(db, repoId, aid));
}

export function mapExplainBase(explain: ExplainPayload) {
  return {
    confidence: explain.confidence,
    nextSuggestedPaths: explain.nextSuggestedPaths,
    relationships: explain.relationships,
    role: explain.role,
    sourcePaths: explain.sourcePaths,
    summary: explain.summary,
    whyImportant: explain.whyImportant,
  };
}

export function mapStructureNodeBase(structureNode: StructureNodePayload) {
  return {
    breadcrumbs: structureNode.breadcrumbs.map((item) => ({
      id: item.id,
      label: item.label,
      path: item.path,
    })),
    canDrillDeeper: structureNode.canDrillDeeper,
    children: structureNode.children,
    edges: structureNode.edges,
    inspect: structureNode.inspect,
    node: structureNode.node,
  };
}

export async function loadLatestDocumentsWithContent(db: DbClient, repoId: string, aid?: string) {
  const docs = await db.document.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      analysis: { select: { publicId: true } },
      content: true,
      publicId: true,
      type: true,
      updatedAt: true,
      version: true,
    },
    where: {
      repo: { publicId: repoId },
      ...(aid != null ? { analysis: { publicId: aid } } : {}),
    },
  });

  return pickLatestDocsByType(docs);
}

export async function loadRelatedDocSections(
  db: DbClient,
  repoId: string,
  nodeId: string,
  nodeLabel: string,
  relatedFiles: string[],
  analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>
) {
  const docs = await loadLatestDocumentsWithContent(db, repoId);
  const graph = analyzeContext.getStructureMap()?.graph ?? null;
  const fileTerms = relatedFiles.flatMap((path) => {
    const fileName = basename(path);
    return [fileName.toLowerCase(), path.toLowerCase()];
  });

  return docs
    .flatMap((doc) => {
      const formatted = DocumentFormatter.withGraphLinks(doc.content, graph, doc.type, doc.version);

      return formatted.sections
        .filter((section) => {
          const lowerTitle = section.title.toLowerCase();
          const lowerContent = section.content.toLowerCase();

          return (
            section.graphNodeIds.includes(nodeId) ||
            lowerTitle.includes(nodeLabel.toLowerCase()) ||
            fileTerms.some((term) => lowerTitle.includes(term) || lowerContent.includes(term))
          );
        })
        .slice(0, 4)
        .map((section) => ({
          docId: doc.publicId,
          docType: doc.type,
          id: section.id,
          title: section.title,
        }));
    })
    .slice(0, 8);
}

export async function loadRelatedPrFindings(db: DbClient, repoId: string, relatedFiles: string[]) {
  if (relatedFiles.length === 0) return [];

  const comments = await db.pullRequestComment.findMany({
    orderBy: [{ analysis: { createdAt: "desc" } }, { riskLevel: "desc" }],
    select: {
      analysis: {
        select: {
          prNumber: true,
          publicId: true,
        },
      },
      body: true,
      filePath: true,
      findingType: true,
      line: true,
      publicId: true,
      riskLevel: true,
    },
    take: 12,
    where: {
      analysis: { repo: { publicId: repoId } },
      filePath: { in: relatedFiles },
    },
  });

  return comments.map((comment) => ({
    body: comment.body,
    filePath: comment.filePath,
    findingType: comment.findingType,
    id: comment.publicId,
    line: comment.line,
    prAnalysisId: comment.analysis.publicId,
    prNumber: comment.analysis.prNumber,
    riskLevel: comment.riskLevel,
  }));
}

export async function loadRelatedFixes(db: DbClient, analysisIds: string[]) {
  const uniqueIds = unique(analysisIds.filter((id) => id.length > 0));
  if (uniqueIds.length === 0) return [];

  const fixes = await db.generatedFix.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      githubPrNumber: true,
      githubPrUrl: true,
      publicId: true,
      status: true,
      title: true,
    },
    take: 8,
    where: {
      prAnalysis: {
        publicId: { in: uniqueIds },
      },
    },
  });

  return fixes.map((fix) => ({
    githubPrNumber: fix.githubPrNumber,
    githubPrUrl: fix.githubPrUrl,
    id: fix.publicId,
    status: fix.status,
    title: fix.title,
  }));
}

export function scoreSearchMatch(terms: string[], values: Array<null | string | undefined>) {
  const haystack = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase());

  if (haystack.length === 0) return 0;

  let score = 0;
  for (const term of terms) {
    const exact = haystack.includes(term);
    const prefix = haystack.some((value) => value.startsWith(term));
    const partial = haystack.some((value) => value.includes(term));

    if (exact) score += 12;
    else if (prefix) score += 8;
    else if (partial) score += 4;
    else return 0;
  }

  return score;
}

export function dedupeSearchResults(results: RepoSearchResult[]) {
  const sortedByBest = orderBy(results, [(r) => r.score], ["desc"]);

  const unique = uniqBy(sortedByBest, (r) => r.id);

  return orderBy(unique, [(r) => r.score, (r) => r.label], ["desc", "asc"]);
}

export function pickLatestDocsByType<TDoc extends { type: DocType; updatedAt: Date }>(
  docs: TDoc[]
) {
  const latest = uniqBy(orderBy(docs, [(d) => d.updatedAt], ["desc"]), (d) => d.type);
  return orderBy(latest, [(d) => d.type], ["asc"]);
}
