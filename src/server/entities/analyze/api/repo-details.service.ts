import { unstable_cache } from "next/cache";
import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import { DocumentFormatter } from "@/server/features/analyze-repo/lib/section-graph-linker";
import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import type { DbClient } from "@/server/shared/infrastructure/db";
import {
  getLatestCompletedAnalysis,
  getRepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";
import { unique } from "@/server/shared/lib/array-utils";
import { resolveDocumentMaterializedPath } from "@/server/shared/lib/document-materialization";
import { markdownToHtml } from "@/server/shared/lib/markdown-to-html";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/shared/lib/search";
import type {
  RepoNodeContextPayload,
  RepoSearchResult,
  RepoWorkspacePayload,
} from "@/server/shared/types";

import { createAnalyzeContextBuilder } from "../lib/analyze-context-builder";
import {
  buildInteractiveBriefNodePayload,
  buildInteractiveBriefPanel,
  buildInteractiveBriefPayload,
} from "../lib/brief";
import { coerceAnalysisPayload } from "../lib/payload";
import { repoDetailsPresenter } from "./repo-details.presenter";

type ExplainPayload = NonNullable<
  ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getNodeExplain"]>
>;
type StructureNodePayload = NonNullable<
  ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getStructureNode"]>
>;

function toBriefPanelInput(params: {
  explain: NonNullable<
    ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getNodeExplain"]>
  >;
  structureNode: NonNullable<
    ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getStructureNode"]>
  >;
}) {
  return {
    explain: mapExplainBase(params.explain),
    structureNode: mapStructureNodeBase(params.structureNode),
  };
}

function toInteractiveBriefNodePayloadInput(params: {
  explain: ExplainPayload;
  structureNode: StructureNodePayload;
}) {
  return {
    explain: {
      analysisRef: params.explain.analysisRef ?? null,
      ...mapExplainBase(params.explain),
    },
    structureNode: {
      analysisRef: params.structureNode.analysisRef ?? null,
      ...mapStructureNodeBase(params.structureNode),
    },
  };
}

export const repoDetailsService = {
  async getAvailableDocs(db: DbClient, repoId: string) {
    const repo = await loadRepoOrThrow(db, repoId);
    return repoDetailsPresenter.toAvailableDocs(repo);
  },

  async getDetailedMetrics(db: DbClient, repoId: string) {
    const analysis = await getLatestCompletedAnalysis(db, repoId);
    return repoDetailsPresenter.toDetailedMetrics(analysis);
  },

  async getDocumentContent(db: DbClient, repoId: string, type: DocType) {
    const doc = await db.document.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        repo: { publicId: repoId },
        type,
      },
    });

    if (doc == null) throw new TRPCError({ code: "NOT_FOUND" });

    const html = await unstable_cache(
      async () => markdownToHtml(doc.content),
      [`doc-html-${doc.publicId}`],
      {
        revalidate: false,
        tags: ["docs", doc.publicId],
      }
    )();

    return {
      html,
      id: doc.publicId,
      materializedPath: resolveDocumentMaterializedPath({
        sourcePath: doc.path,
        type: doc.type,
      }),
      raw: doc.content,
      sourcePath: doc.path,
    };
  },

  async getHistory(db: DbClient, repoId: string) {
    const history = await db.analysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        commitSha: true,
        createdAt: true,
        message: true,
        publicId: true,
        score: true,
        status: true,
      },
      where: { repo: { publicId: repoId } },
    });

    return history.map((h) => ({
      commitSha: h.commitSha,
      createdAt: h.createdAt,
      id: h.publicId,
      message: h.message,
      score: h.score,
      status: h.status,
    }));
  },

  async getInteractiveBrief(db: DbClient, repoId: string) {
    const repo = await loadRepoOrThrow(db, repoId);
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const overview = repoDetailsPresenter.toOverview(repo);
    const structure = analyzeContext.getStructureMap();

    if (structure == null || overview == null) return null;

    const defaultNodeId = structure.selection.defaultNodeId;
    const panel =
      defaultNodeId == null
        ? null
        : (() => {
            const structureNode = analyzeContext.getStructureNode(defaultNodeId);
            const explain = analyzeContext.getNodeExplain(defaultNodeId);
            if (structureNode == null || explain == null) return null;

            return buildInteractiveBriefPanel(toBriefPanelInput({ explain, structureNode }));
          })();

    return buildInteractiveBriefPayload({
      analysisRef: structure.analysisRef,
      capabilities: {
        canDocumentFile: true,
        canDrillDown: true,
        canExplainNodes: true,
        canHighlightFiles: true,
        canQuickAudit: true,
      },
      defaultNodeId,
      docsSummary: {
        availableCount: overview.docs.availableCount,
        availableTypes: overview.docs.availableTypes,
        hasSwagger: overview.docs.hasSwagger,
      },
      overview: {
        architectureStyle: structure.overview.architectureStyle,
        primaryEntrypoints: structure.overview.primaryEntrypoints,
        primaryModules: structure.overview.primaryModules,
        purpose: structure.overview.purpose,
        repositoryKind: structure.overview.repositoryKind,
        stack: structure.overview.stack,
      },
      panel,
      structure: {
        edges: structure.graph.edges,
        groups: structure.graph.groups,
        nodes: structure.graph.nodes,
      },
    });
  },

  async getInteractiveBriefNode(db: DbClient, repoId: string, nodeId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) return null;

    return buildInteractiveBriefNodePayload(
      toInteractiveBriefNodePayloadInput({ explain, structureNode })
    );
  },

  async getNodeContext(
    db: DbClient,
    repoId: string,
    nodeId: string
  ): Promise<null | RepoNodeContextPayload> {
    const repo = await loadRepoOrThrow(db, repoId);
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) return null;

    const relatedFiles = unique(
      [
        structureNode.node.path,
        ...structureNode.node.previewPaths,
        ...structureNode.inspect.samplePaths,
        ...explain.sourcePaths,
      ].map((path) => normalizeRepoPath(path))
    ).slice(0, 12);

    const [docs, findings] = await Promise.all([
      loadRelatedDocSections(
        db,
        repoId,
        nodeId,
        structureNode.node.label,
        relatedFiles,
        analyzeContext
      ),
      loadRelatedPrFindings(db, repoId, relatedFiles),
    ]);

    const fixes = await loadRelatedFixes(
      db,
      findings.map((finding) => finding.prAnalysisId)
    );

    return {
      ...buildInteractiveBriefNodePayload(
        toInteractiveBriefNodePayloadInput({ explain, structureNode })
      ),
      related: {
        docs,
        files: relatedFiles,
        findings,
        fixes,
      },
    };
  },

  async getNodeExplain(db: DbClient, repoId: string, nodeId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    return analyzeContext.getNodeExplain(nodeId);
  },

  async getOverview(db: DbClient, repoId: string) {
    const repo = await loadRepoOrThrow(db, repoId);
    return repoDetailsPresenter.toOverview(repo);
  },

  async getStructureMap(db: DbClient, repoId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    return analyzeContext.getStructureMap();
  },

  async getStructureNode(db: DbClient, repoId: string, nodeId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    return analyzeContext.getStructureNode(nodeId);
  },

  async getWorkspace(db: DbClient, repoId: string): Promise<null | RepoWorkspacePayload> {
    const repo = await loadRepoOrThrow(db, repoId);
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const overview = repoDetailsPresenter.toOverview(repo);
    const structure = analyzeContext.getStructureMap();

    if (overview == null || structure == null) return null;

    return {
      analysisRef: structure.analysisRef,
      docs: {
        availableCount: overview.docs.availableCount,
        availableTypes: overview.docs.availableTypes,
        hasSwagger: overview.docs.hasSwagger,
        items: overview.docs.items.map((item) => ({
          id: item.id,
          source: item.source === "llm" ? "llm" : null,
          status: item.status,
          type: item.type,
          updatedAt: item.updatedAt,
          version: item.version,
        })),
      },
      mostComplexFiles: overview.mostComplexFiles,
      navigation: {
        defaultNodeId: structure.selection.defaultNodeId,
        keyZones: structure.graph.nodes.slice(0, 6),
        primaryEntrypoints: structure.overview.primaryEntrypoints,
        primaryModules: structure.overview.primaryModules,
      },
      repo: {
        defaultBranch: overview.repo.defaultBranch,
        description: overview.repo.description,
        forks: overview.repo.forks,
        id: overview.repo.id,
        language: overview.repo.language,
        languageColor: overview.repo.languageColor,
        license: overview.repo.license,
        name: overview.repo.name,
        openIssues: overview.repo.openIssues,
        owner: overview.repo.owner,
        ownerAvatarUrl: overview.repo.ownerAvatarUrl,
        pushedAt: overview.repo.pushedAt,
        size: overview.repo.size,
        stars: overview.repo.stars,
        topics: overview.repo.topics,
        url: overview.repo.url,
        visibility: overview.repo.visibility,
      },
      secondary: {
        languages: overview.languages,
        scores: overview.scores,
        signals: overview.signals,
        stats: overview.stats,
      },
      summary: {
        architectureStyle: structure.overview.architectureStyle,
        maintenance: overview.maintenance,
        purpose: structure.overview.purpose,
        repositoryKind: structure.overview.repositoryKind,
        stack: structure.overview.stack,
      },
      topRisks: overview.topRisks.map((risk) => ({
        id: risk.id,
        severity: risk.severity,
        suggestedNextChange: risk.suggestedNextChange,
        summary: risk.summary,
        title: risk.title,
      })),
    };
  },

  async highlightFile(content: string, path: string) {
    const ext = path.split(".").pop() ?? "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },

  async searchWorkspace(db: DbClient, repoId: string, search: string): Promise<RepoSearchResult[]> {
    const normalizedSearch = normalizeSearchInput(search);
    const terms = tokenizeSearchInput(search);
    if (normalizedSearch == null || terms.length === 0) return [];

    const repo = await loadRepoOrThrow(db, repoId);
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structure = analyzeContext.getStructureMap();
    const structureContext = analyzeContext.getEntityContext().structureContext;
    const payload = coerceAnalysisPayload(repo.analyses[0]);

    if (structure == null || structureContext == null || payload == null) return [];

    const docs = await loadLatestDocumentsWithContent(db, repoId);
    const results: RepoSearchResult[] = [];

    for (const node of structure.graph.nodes) {
      const score = scoreSearchMatch(terms, [node.label, node.path, node.description, node.kind]);
      if (score === 0) continue;

      results.push({
        description: node.description,
        docSectionId: null,
        docType: null,
        id: `node:${node.id}`,
        kind: "node",
        label: node.label,
        nodeId: node.id,
        path: node.path,
        score,
        targetView: "map",
      });
    }

    for (const path of structureContext.allInterestingPaths) {
      const label = path.split("/").pop() ?? path;
      const score = scoreSearchMatch(terms, [label, path]);
      if (score === 0) continue;

      results.push({
        description: path,
        docSectionId: null,
        docType: null,
        id: `file:${path}`,
        kind: "file",
        label,
        nodeId: `file:${path}`,
        path,
        score,
        targetView: "code",
      });
    }

    for (const entrypoint of structure.overview.primaryEntrypoints) {
      const score = scoreSearchMatch(terms, [entrypoint, entrypoint.split("/").pop()]);
      if (score === 0) continue;

      results.push({
        description: "Primary entrypoint",
        docSectionId: null,
        docType: null,
        id: `entrypoint:${entrypoint}`,
        kind: "entrypoint",
        label: entrypoint.split("/").pop() ?? entrypoint,
        nodeId: `file:${entrypoint}`,
        path: entrypoint,
        score: score + 5,
        targetView: "code",
      });
    }

    for (const route of payload.metrics.routeInventory?.httpRoutes ?? []) {
      const sourceFile = route.sourcePath;
      const routePattern = route.path;
      const score = scoreSearchMatch(terms, [route.method, routePattern, sourceFile]);
      if (score === 0) continue;

      results.push({
        description: `${route.method} route defined in ${sourceFile}`,
        docSectionId: null,
        docType: null,
        id: `route:${route.method}:${routePattern}:${sourceFile}`,
        kind: "route",
        label: `${route.method} ${routePattern}`,
        nodeId: `file:${sourceFile}`,
        path: sourceFile,
        score: score + 3,
        targetView: "code",
      });
    }

    const graph = structure.graph;
    for (const doc of docs) {
      const formatted = DocumentFormatter.withGraphLinks(doc.content, graph, doc.type, doc.version);
      for (const section of formatted.sections) {
        const score = scoreSearchMatch(terms, [section.title, section.content, doc.type]);
        if (score === 0) continue;

        results.push({
          description: `${doc.type} section`,
          docSectionId: section.id,
          docType: doc.type,
          id: `${doc.publicId}:${section.id}`,
          kind: "doc-section",
          label: section.title,
          nodeId: section.graphNodeIds[0] ?? null,
          path: null,
          score,
          targetView: "docs",
        });
      }
    }

    return dedupeSearchResults(results)
      .toSorted((left, right) => right.score - left.score || left.label.localeCompare(right.label))
      .slice(0, 24);
  },
};

async function loadRepoOrThrow(db: DbClient, repoId: string) {
  const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);
  if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
  return repo;
}

async function loadAnalyzeContextBuilderOrThrow(db: DbClient, repoId: string) {
  return createAnalyzeContextBuilder(await loadRepoOrThrow(db, repoId));
}

function mapExplainBase(explain: ExplainPayload) {
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

function mapStructureNodeBase(structureNode: StructureNodePayload) {
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

async function loadLatestDocumentsWithContent(db: DbClient, repoId: string) {
  const docs = await db.document.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      content: true,
      publicId: true,
      type: true,
      updatedAt: true,
      version: true,
    },
    where: { repo: { publicId: repoId } },
  });

  return pickLatestDocsByType(docs);
}

async function loadRelatedDocSections(
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
    const fileName = path.split("/").pop();
    return fileName != null ? [fileName.toLowerCase(), path.toLowerCase()] : [path.toLowerCase()];
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

async function loadRelatedPrFindings(db: DbClient, repoId: string, relatedFiles: string[]) {
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

async function loadRelatedFixes(db: DbClient, analysisIds: string[]) {
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

function scoreSearchMatch(terms: string[], values: Array<null | string | undefined>) {
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

function dedupeSearchResults(results: RepoSearchResult[]) {
  const seen = new Map<string, RepoSearchResult>();

  for (const result of results) {
    const existing = seen.get(result.id);
    if (existing == null || result.score > existing.score) {
      seen.set(result.id, result);
    }
  }

  return [...seen.values()];
}

function pickLatestDocsByType<TDoc extends { type: DocType; updatedAt: Date }>(docs: TDoc[]) {
  const latestByType = new Map<DocType, TDoc>();

  for (const doc of docs.toSorted(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
  )) {
    if (!latestByType.has(doc.type)) {
      latestByType.set(doc.type, doc);
    }
  }

  return [...latestByType.values()].sort((left, right) => left.type.localeCompare(right.type));
}
