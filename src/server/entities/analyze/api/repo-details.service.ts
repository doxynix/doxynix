import { unstable_cache } from "next/cache";
import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { basename, extname } from "pathe";

import { highlightCode } from "@/shared/lib/shiki";

import { DocumentFormatter } from "@/server/features/analyze-repo/lib/section-graph-linker";
import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import type { DbClient } from "@/server/shared/infrastructure/db";
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
import {
  dedupeSearchResults,
  loadAnalyzeContextBuilderOrThrow,
  loadLatestDocumentsWithContent,
  loadRelatedDocSections,
  loadRelatedFixes,
  loadRelatedPrFindings,
  loadRepoOrThrow,
  scoreSearchMatch,
} from "../lib/repo-details-helpers";
import { repoDetailsPresenter } from "./repo-details.presenter";

export const repoDetailsService = {
  async getAvailableDocs(db: DbClient, repoId: string, aid?: string) {
    const repo = await loadRepoOrThrow(db, repoId, aid);
    return repoDetailsPresenter.toAvailableDocs(repo);
  },

  async getDetailedMetrics(db: DbClient, repoId: string, aid?: string) {
    const repo = await loadRepoOrThrow(db, repoId, aid);
    return repoDetailsPresenter.toDetailedMetrics(repo.analyses[0] ?? null);
  },

  async getDocumentContent(db: DbClient, repoId: string, type: DocType, aid?: string) {
    const repo = await loadRepoOrThrow(db, repoId, aid);
    const analysis = repo.analyses[0];

    if (analysis == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
    }

    const doc = await db.document.findFirst({
      where: {
        analysis: {
          publicId: analysis.publicId,
        },
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

  async getInteractiveBrief(db: DbClient, repoId: string, aid?: string) {
    const repo = await loadRepoOrThrow(db, repoId, aid);
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

            return buildInteractiveBriefPanel(
              repoDetailsPresenter.toBriefPanelInput({ explain, structureNode })
            );
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

  async getInteractiveBriefNode(db: DbClient, repoId: string, nodeId: string, aid?: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId, aid);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) return null;

    return buildInteractiveBriefNodePayload(
      repoDetailsPresenter.toInteractiveBriefNodePayloadInput({ explain, structureNode })
    );
  },

  async getNodeContext(
    db: DbClient,
    repoId: string,
    nodeId: string,
    aid?: string
  ): Promise<null | RepoNodeContextPayload> {
    const repo = await loadRepoOrThrow(db, repoId, aid);
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
    );

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
        repoDetailsPresenter.toInteractiveBriefNodePayloadInput({ explain, structureNode })
      ),
      related: {
        docs,
        files: relatedFiles,
        findings,
        fixes,
      },
    };
  },

  async getNodeExplain(db: DbClient, repoId: string, nodeId: string, aid?: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId, aid);
    return analyzeContext.getNodeExplain(nodeId);
  },

  async getOverview(db: DbClient, repoId: string, aid?: string) {
    const repo = await loadRepoOrThrow(db, repoId, aid);
    return repoDetailsPresenter.toOverview(repo);
  },

  async getStructureMap(db: DbClient, repoId: string, aid?: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId, aid);
    return analyzeContext.getStructureMap();
  },

  async getStructureNode(db: DbClient, repoId: string, nodeId: string, aid?: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId, aid);
    return analyzeContext.getStructureNode(nodeId);
  },

  async getWorkspace(
    db: DbClient,
    repoId: string,
    aid?: string
  ): Promise<null | RepoWorkspacePayload> {
    const repo = await loadRepoOrThrow(db, repoId, aid);
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
        keyZones: structure.graph.nodes,
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
    const ext = extname(path).replace(".", "") || "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },

  async searchWorkspace(
    db: DbClient,
    repoId: string,
    search: string,
    aid?: string
  ): Promise<RepoSearchResult[]> {
    const normalizedSearch = normalizeSearchInput(search);
    const terms = tokenizeSearchInput(search);
    if (normalizedSearch == null || terms.length === 0) return [];

    const repo = await loadRepoOrThrow(db, repoId, aid);
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structure = analyzeContext.getStructureMap();
    const structureContext = analyzeContext.getEntityContext().structureContext;
    const payload = coerceAnalysisPayload(repo.analyses[0]);

    if (structure == null || structureContext == null || payload == null) return [];

    const docs = await loadLatestDocumentsWithContent(db, repoId, aid);
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
      const label = basename(path);
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
      const score = scoreSearchMatch(terms, [entrypoint, basename(entrypoint)]);
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

    return dedupeSearchResults(results).toSorted(
      (left, right) => right.score - left.score || left.label.localeCompare(right.label)
    );
  },
};
