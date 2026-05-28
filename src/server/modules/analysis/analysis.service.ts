import { unstable_cache } from "next/cache";
import { DocType, Status, type Prisma, type Repo } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";
import { uniq } from "es-toolkit";
import { basename, extname, normalize } from "pathe";
import type { z } from "zod";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";
import { generateBranchName } from "@/shared/lib/get-branch-name";
import { highlightCode } from "@/shared/lib/shiki";

import { appLogger } from "@/server/core/app-logger";
import { prisma, type DbClient } from "@/server/core/db";
import { getInstallationClient } from "@/server/core/github/github-provider";
import { realtimeServer } from "@/server/core/realtime";
import { callWithFallback } from "@/server/utils/call";
import { resolveDocumentMaterializedPath } from "@/server/utils/document-materialization";
import { markdownToHtml } from "@/server/utils/markdown-to-html";
import { CodeOptimizer } from "@/server/utils/optimizers";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/utils/search";
import type {
  PRImpactPayload,
  RepoNodeContextPayload,
  RepoSearchResult,
  RepoWorkspacePayload,
} from "@/server/utils/types";

import { getActiveModels } from "./ai/ai-constants";
import { buildCodeDocSystemPrompt } from "./ai/prompts-refactored";
import { analysisContext, type NodeContext } from "./analysis.context";
import { analysisMapper } from "./analysis.mapper";
import { analysisRepo, type AnalysisRef } from "./analysis.repository";
import {
  DocumentFilePreviewSchema,
  type DocumentFilePreviewResult,
  type FileActionNodeContext,
} from "./analysis.schemas";
import {
  buildContextPromptGuidance,
  buildContextSection,
  buildDocumentFallback,
  dedupeSearchResults,
  deriveMaintenanceStatus,
  describeContextQualifier,
  getNonActionableReason,
  isBinaryLikeContent,
  scoreSearchMatch,
} from "./analysis.utils";
import type { AIResult } from "./engine/core/analysis-result.schemas";
import type { RepoMetrics } from "./engine/core/metrics.types";
import { calculateTeamRoles } from "./engine/metrics/common-metrics";
import { calculateHealthScore } from "./engine/metrics/complexity";
import { createAnalyzeContextBuilder } from "./logic/analyze-context-builder";
import {
  buildInteractiveBriefNodePayload,
  buildInteractiveBriefPanel,
  buildInteractiveBriefPayload,
} from "./logic/brief";
import { calculateDocumentationOutputScore } from "./logic/doc-priority";
import { FixService } from "./logic/fix-generator";
import { buildTopLevelNodes } from "./logic/graph-navigator";
import { coerceAnalysisPayload } from "./logic/payload";
import { buildSyncFileActionMeta } from "./logic/repo-file-action-state";
import { DocumentFormatter } from "./logic/section-graph-linker";
import { makeStructureNodeId } from "./logic/structure-shared";

type GeneratedDocsData = {
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedChangelog?: string;
  generatedContributing?: string;
  generatedReadme?: string;
  swaggerYaml?: string;
};

type SaveResultsParams = {
  aiResult: AIResult;
  analysisId: string;
  busFactor: number;
  channelName: string;
  currentSha: string;
  generatedDocsData: GeneratedDocsData;
  hardMetrics: RepoMetrics;
  rawContributors: { contributions: number; login: string }[];
  repo: Repo;
  repositoryFacts: NonNullable<AIResult["repository_facts"]>;
  repositoryFindings: NonNullable<AIResult["findings"]>;
  userId: number;
};

export type FileActionInput = {
  analysisId?: string;
  commitSha?: string;
  content: string;
  language: string;
  nodeContext?: FileActionNodeContext | NodeContext;
  nodeId?: string;
  path: string;
  repoId: string;
};

export const repoAnalysisService = {
  async analyze(
    db: DbClient,
    userId: number,
    input: {
      branch?: string;
      docTypes: DocType[];
      files: string[];
      instructions?: string;
      language: string;
      repoId: string;
    }
  ) {
    await this.assertRepoAccess(db, userId, input.repoId);

    const analysis = await db.analysis.create({
      data: {
        repo: {
          connect: {
            publicId: input.repoId,
          },
        },
        status: "PENDING",
      },
    });

    const handle = await tasks.trigger(
      "analyze-repo",
      {
        analysisId: analysis.publicId,
        docTypes: input.docTypes,
        instructions: input.instructions,
        language: input.language,
        selectedBranch: input.branch,
        selectedFiles: input.files,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `analysis-${analysis.publicId}`,
        ttl: "30m",
      }
    );

    await db.analysis.update({
      data: { jobId: handle.id },
      where: { publicId: analysis.publicId },
    });

    return { jobId: handle.id, publicAccessToken: handle.publicAccessToken, status: "QUEUED" };
  },

  async assertRepoAccess(db: DbClient, userId: number, repoId: string) {
    const repo = await db.repo.findFirst({
      where: { publicId: repoId, userId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repo;
  },

  async autoSyncDocsToGithub(
    db: DbClient,
    userId: number,
    repo: Repo,
    generatedDocsData: GeneratedDocsData,
    commitSha: string
  ): Promise<null | { prNumber: number; prUrl: string }> {
    const fileChanges: Record<string, string> = {};

    if (generatedDocsData.generatedReadme != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "README" })] =
        generatedDocsData.generatedReadme;
    }
    if (generatedDocsData.generatedApiMarkdown != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "API" })] =
        generatedDocsData.generatedApiMarkdown;
    }
    if (generatedDocsData.generatedArchitecture != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "ARCHITECTURE" })] =
        generatedDocsData.generatedArchitecture;
    }
    if (generatedDocsData.generatedContributing != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "CONTRIBUTING" })] =
        generatedDocsData.generatedContributing;
    }
    if (generatedDocsData.generatedChangelog != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "CHANGELOG" })] =
        generatedDocsData.generatedChangelog;
    }

    const filePaths = Object.keys(fileChanges);
    if (filePaths.length === 0) {
      appLogger.info({
        msg: "No generated documentation files to sync to GitHub.",
        repoId: repo.id,
      });
      return null;
    }

    try {
      const installation = await db.githubInstallation.findFirst({
        where: {
          accountLogin: { equals: repo.owner, mode: "insensitive" },
          isSuspended: false,
        },
      });

      if (installation == null) {
        appLogger.warn({
          msg: "GitHub App installation not found. Skipping automatic documentation PR.",
          repoId: repo.id,
        });
        return null;
      }

      const botOctokit = getInstallationClient(Number(installation.id));

      const branchName = generateBranchName();
      const fix = await analysisRepo.create(db, {
        branch: branchName,
        createdByUser: false,
        description: `Automatically generated documentation update based on commit ${commitSha.slice(0, 7)}.`,
        repoId: repo.publicId,
        title: "Doxynix: Sync Project Documentation",
      });

      const fixService = new FixService();
      const result = await fixService.applyFix(botOctokit, {
        branch: branchName,
        defaultBranch: repo.defaultBranch,
        fixedFiles: Object.entries(fileChanges).map(([filePath, newContent]) => ({
          filePath,
          newContent,
        })),
        fixId: fix.publicId,
        owner: repo.owner,
        repoId: repo.publicId,
        repoName: repo.name,
        title: "📝 Doxynix: Sync latest project documentation",
      });

      await analysisRepo.updateStatus(db, fix.publicId, "PR_OPENED", {
        githubPrNumber: result.prNumber,
        githubPrUrl: result.prUrl,
      });

      appLogger.info({
        msg: "Documentation sync PR successfully opened on GitHub",
        prNumber: result.prNumber,
        repoId: repo.id,
      });

      return result;
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to automatically sync documentation to GitHub.",
        repoId: repo.id,
      });
      return null;
    }
  },

  async buildFileActionRuntimeContext(db: DbClient, input: { nodeId?: string; repoId: string }) {
    const [nodeContext, analysisRef] = await Promise.all([
      analysisContext.build(db, input.repoId, input.nodeId),
      analysisRepo.getLatestRef(db, input.repoId),
    ]);

    return { analysisRef, nodeContext };
  },

  buildSyncFileMeta(
    input: { analysisId?: string; commitSha?: string },
    nodeContext: NodeContext | null,
    analysisRef: AnalysisRef | null
  ) {
    return buildSyncFileActionMeta({
      analysisRef,
      contentRef: {
        analysisId: input.analysisId,
        commitSha: input.commitSha,
      },
      contextDiagnostics: analysisContext.getDiagnostics(nodeContext),
      contextMeta: analysisContext.getMeta(nodeContext),
    });
  },

  async documentFile(db: DbClient, userId: number, input: FileActionInput) {
    return this.runFileAction(db, userId, "document-single-file", input);
  },

  async getAvailableDocs(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return [];
    return analysisMapper.toAvailableDocs(repo);
  },

  async getByRepoAndPRNumber(db: DbClient, repoId: string, prNumber: number) {
    const analysis = await analysisRepo.loadImpactAnalysis(db, repoId, prNumber);
    if (analysis == null) return null;

    const changedFiles = analysisMapper.parseChangedFilesSnapshot(analysis);
    const findings = analysisMapper.parsePersistedFindings(analysis);

    // Get the repository snapshot tied to the same commit as the PR analysis
    const repo = await analysisRepo.getRepoBySha(db, repoId, analysis.headSha);

    // Fallback to latest analysis if no analysis exists for the specific commit
    const repoSnapshot = repo ?? (await analysisRepo.getRepoSnapshot(db, repoId));

    if (repoSnapshot == null) {
      return null;
    }

    const analyzeContext = createAnalyzeContextBuilder(repoSnapshot);
    const structureContext = analyzeContext.getStructureContext();
    const topLevelNodes = structureContext == null ? [] : buildTopLevelNodes(structureContext);
    const interestingPaths = new Set(structureContext?.allInterestingPaths ?? []);
    const nodeById = new Map(topLevelNodes.map((node) => [node.id, node] as const));
    const nodeDetailCache = new Map<string, ReturnType<typeof analyzeContext.getStructureNode>>();
    const findingsByFile = analysisMapper.countFindingsByFile(findings);

    const changedFileItems = changedFiles.map((file) => {
      const normalizedFilePath = normalize(file.filePath);
      const normalizedPreviousPath =
        file.previousFilePath == null ? null : normalize(file.previousFilePath);
      const directNodeId = interestingPaths.has(normalizedFilePath)
        ? makeStructureNodeId("file", normalizedFilePath)
        : null;
      const zoneNode = analysisMapper.matchTopLevelZone(
        topLevelNodes,
        normalizedFilePath,
        normalizedPreviousPath
      );
      const matchedNodeId = directNodeId ?? zoneNode?.id ?? null;
      const matchedNode =
        matchedNodeId == null
          ? null
          : analysisMapper.resolveMatchedNode(
              matchedNodeId,
              analyzeContext,
              nodeById,
              nodeDetailCache
            );
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

    const affectedZones = analysisMapper.buildAffectedZones(changedFileItems, findings, nodeById);
    const affectedNodes = analysisMapper.buildAffectedNodes(
      changedFileItems,
      findings,
      analyzeContext,
      nodeById,
      nodeDetailCache
    );
    const topFindings = await analysisMapper.buildTopFindings(
      findings,
      changedFileItems,
      nodeById,
      repoSnapshot.owner,
      repoSnapshot.name
    );
    const primaryFile = analysisMapper.selectPrimaryFile(changedFileItems);
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

  async getDetailedMetrics(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    return analysisMapper.toDetailedMetrics(repo.analyses[0] ?? null);
  },
  async getDocumentContent(db: DbClient, repoId: string, type: DocType, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
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
      async () =>
        markdownToHtml({
          content: doc.content,
          name: repo.name,
          owner: repo.owner,
        }),
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
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const overview = analysisMapper.toOverview(repo);
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
              analysisMapper.toBriefPanelInput({ explain, structureNode })
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
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) return null;

    return buildInteractiveBriefNodePayload(
      analysisMapper.toInteractiveBriefNodePayloadInput({ explain, structureNode })
    );
  },

  async getNodeContext(
    db: DbClient,
    repoId: string,
    nodeId: string,
    aid?: string
  ): Promise<null | RepoNodeContextPayload> {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) return null;

    const relatedFiles = uniq(
      [
        structureNode.node.path,
        ...structureNode.node.previewPaths,
        ...structureNode.inspect.samplePaths,
        ...explain.sourcePaths,
      ].map((path) => normalize(path))
    );

    const [docs, findings] = await Promise.all([
      this.loadRelatedDocSections(
        db,
        repoId,
        nodeId,
        structureNode.node.label,
        relatedFiles,
        analyzeContext
      ),
      analysisRepo.loadRelatedPrFindings(db, repoId, relatedFiles),
    ]);

    const fixes = await analysisRepo.loadRelatedFixes(
      db,
      findings.map((finding) => finding.prAnalysisId)
    );

    return {
      ...buildInteractiveBriefNodePayload(
        analysisMapper.toInteractiveBriefNodePayloadInput({ explain, structureNode })
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
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    return analyzeContext.getNodeExplain(nodeId);
  },

  async getOverview(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    return analysisMapper.toOverview(repo);
  },

  async getStructureMap(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    return analyzeContext.getStructureMap();
  },

  async getStructureNode(db: DbClient, repoId: string, nodeId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    return analyzeContext.getStructureNode(nodeId);
  },

  async getWorkspace(
    db: DbClient,
    repoId: string,
    aid?: string
  ): Promise<null | RepoWorkspacePayload> {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return null;
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const overview = analysisMapper.toOverview(repo);
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
    const ext = extname(path).slice(1).toLowerCase() || "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },

  async loadRelatedDocSections(
    db: DbClient,
    repoId: string,
    nodeId: string,
    nodeLabel: string,
    relatedFiles: string[],
    analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>
  ) {
    const docs = await analysisRepo.loadLatestDocumentsWithContent(db, repoId);
    const graph = analyzeContext.getStructureMap()?.graph ?? null;

    const fileTerms = relatedFiles.flatMap((path) => {
      const fileName = basename(path);
      return [fileName.toLowerCase(), path.toLowerCase()];
    });

    const searchLabel = nodeLabel.toLowerCase();

    return docs
      .flatMap((doc) => {
        const formatted = DocumentFormatter.withGraphLinks(
          doc.content,
          graph,
          doc.type,
          doc.version
        );

        return formatted.sections
          .filter((section) => {
            const lowerTitle = section.title.toLowerCase();
            const lowerContent = section.content.toLowerCase();

            return (
              section.graphNodeIds.includes(nodeId) ||
              lowerTitle.includes(searchLabel) ||
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
  },

  async runDocumentFilePreview(input: FileActionInput): Promise<DocumentFilePreviewResult> {
    const rawContent = input.content.trim();

    if (rawContent.length === 0) {
      return buildDocumentFallback(
        input.path,
        `The file is empty, so there is nothing useful to document yet. ${describeContextQualifier(input.nodeContext)}`
      );
    }

    if (isBinaryLikeContent(input.content)) {
      return buildDocumentFallback(
        input.path,
        `The file looks binary or non-textual, so documentation preview is not available. ${describeContextQualifier(input.nodeContext)}`
      );
    }

    const nonActionableReason = getNonActionableReason(
      input.path,
      input.content,
      input.nodeContext
    );
    if (nonActionableReason != null) {
      return buildDocumentFallback(input.path, nonActionableReason);
    }

    const cleanedCode = await CodeOptimizer.optimize(input.content, input.path);
    const contextSection = buildContextSection(input);
    const contextGuidance = buildContextPromptGuidance(input.nodeContext);

    const systemPrompt = [
      buildCodeDocSystemPrompt(input.language),
      "\n[CONTEXT HANDLING GUIDANCE]",
      contextGuidance,
    ].join("\n");

    const userPrompt = [
      `<target_file path="${input.path}">`,
      cleanedCode,
      "</target_file>",
      contextSection,
    ]
      .filter(Boolean)
      .join("\n");

    const activeModels = await getActiveModels();

    const result = await callWithFallback<z.infer<typeof DocumentFilePreviewSchema>>({
      attemptMetadata: { filePath: input.path, operation: "document-file-preview" },
      models: activeModels.WRITER,
      outputSchema: DocumentFilePreviewSchema,
      prompt: userPrompt,
      system: systemPrompt,
      taskType: "creative",
    });

    return {
      ...result,
      path: input.path,
    };
  },

  async runFileAction(
    db: DbClient,
    userId: number,
    taskId: "analyze-single-file" | "document-single-file",
    input: FileActionInput
  ) {
    await this.assertRepoAccess(db, userId, input.repoId);

    const { analysisRef, nodeContext } = await this.buildFileActionRuntimeContext(db, input);

    const syncMeta = this.buildSyncFileMeta(input, nodeContext, analysisRef);

    const handle = await tasks.trigger(
      taskId,
      {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
        syncMeta,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `${taskId}-${input.repoId}-${input.path}`,
        ttl: "10m",
      }
    );

    return { jobId: handle.id };
  },

  async saveResults(params: SaveResultsParams): Promise<number> {
    const {
      aiResult,
      analysisId,
      busFactor,
      channelName,
      currentSha,
      generatedDocsData,
      hardMetrics,
      rawContributors,
      repo,
      repositoryFacts,
      repositoryFindings,
      userId,
    } = params;

    const teamRoles = calculateTeamRoles(rawContributors);

    const scoringContext: AIResult & GeneratedDocsData = {
      ...aiResult,
      ...generatedDocsData,
    };

    const docOutputScore = calculateDocumentationOutputScore(scoringContext);

    const onboardingScore = Math.min(
      100,
      docOutputScore.score +
        (hardMetrics.docDensity > 10 ? 10 : 0) +
        (hardMetrics.entrypoints.length > 0 ? 15 : 0) +
        (hardMetrics.configFiles > 0 ? 10 : 0) +
        (repositoryFacts.some((fact) => fact.category === "architecture") ? 10 : 0)
    );

    const finalHealthScore = calculateHealthScore({
      busFactor,
      complexityScore: hardMetrics.complexityScore,
      dependencyCycles: hardMetrics.dependencyCycles.length,
      docDensity: hardMetrics.docDensity,
      duplicationPercentage: hardMetrics.duplicationReport.duplicationPercentage,
      repo,
      securityScore: hardMetrics.securityScore,
      techDebtScore: hardMetrics.techDebtScore,
    });

    const resultToStore = {
      ...aiResult,
      complexityScore: hardMetrics.complexityScore,
      findings: repositoryFindings,
      mostComplexFiles: hardMetrics.mostComplexFiles,
      onboardingScore,
      repository_facts: repositoryFacts,
      securityScore: hardMetrics.securityScore,
      techDebtScore: hardMetrics.techDebtScore,
      vulnerabilities: hardMetrics.securityFindings.map((f) => ({
        description: f.message,
        file: f.path,
        lineHint: f.line != null ? `line ${f.line}` : undefined,
        risk: f.severity === "error" ? "HIGH" : "MODERATE",
        suggestion:
          "Review the flagged secret-like value and replace it with a safe managed secret.",
      })),
    };

    const finalMetrics: RepoMetrics = {
      ...hardMetrics,
      busFactor,
      factCount: repositoryFacts.length,
      findingCount: repositoryFindings.length,
      healthScore: finalHealthScore,
      maintenanceStatus: deriveMaintenanceStatus(repo),
      onboardingScore,
      teamRoles,
    };

    appLogger.info({
      analysisId,
      finalHealthScore,
      metricsSummary: {
        docs: docOutputScore.snapshot,
        fileCount: finalMetrics.fileCount,
        mostComplexFiles: finalMetrics.mostComplexFiles,
        totalLoc: finalMetrics.totalLoc,
      },
      msg: "Metrics computed, saving results",
      repoId: repo.id,
    });

    const note = await prisma.$transaction(async (tx) => {
      const analysis = await tx.analysis.update({
        data: {
          commitSha: currentSha,
          complexityScore: hardMetrics.complexityScore,
          message: "Completed successfully",
          metricsJson: finalMetrics as unknown as Prisma.InputJsonValue,
          onboardingScore: onboardingScore,
          progress: 100,
          resultJson: resultToStore as unknown as Prisma.InputJsonValue,
          score: finalHealthScore,
          securityScore: hardMetrics.securityScore,
          status: Status.DONE,
          techDebtScore: hardMetrics.techDebtScore,
        },
        where: { publicId: analysisId },
      });

      const docsToSave = [
        { content: generatedDocsData.generatedReadme, type: DocType.README },
        { content: generatedDocsData.generatedApiMarkdown, type: DocType.API },
        { content: generatedDocsData.generatedContributing, type: DocType.CONTRIBUTING },
        { content: generatedDocsData.generatedChangelog, type: DocType.CHANGELOG },
        { content: generatedDocsData.generatedArchitecture, type: DocType.ARCHITECTURE },
      ].filter((doc) => doc.content != null && doc.content.length > 0);

      await Promise.all(
        docsToSave.map((doc) =>
          tx.document.upsert({
            create: {
              analysisId: analysis.id,
              content: doc.content!,
              repoId: repo.id,
              type: doc.type,
              version: currentSha,
            },
            update: { content: doc.content! },
            where: {
              repoId_version_type_analysisId: {
                analysisId: analysis.id,
                repoId: repo.id,
                type: doc.type,
                version: currentSha,
              },
            },
          })
        )
      );

      return tx.notification.create({
        data: {
          body: `Health Score: ${finalHealthScore}/100`,
          repoId: repo.id,
          title: `Analysis for ${repo.owner}/${repo.name} ready`,
          type: "SUCCESS",
          userId,
        },
      });
    });

    await realtimeServer.channels
      .get(channelName)
      .publish(REALTIME_CONFIG.events.user.notification, {
        id: note.publicId,
        title: note.title,
      });

    appLogger.info({ analysisId, commitSha: currentSha, msg: "Results saved", repoId: repo.id });

    this.autoSyncDocsToGithub(prisma, userId, repo, generatedDocsData, currentSha).catch(
      (error) => {
        appLogger.error({
          error,
          msg: "Failed background auto-sync of documentation to GitHub",
          repoId: repo.id,
        });
      }
    );

    return finalHealthScore;
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

    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) return [];
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structure = analyzeContext.getStructureMap();
    const structureContext = analyzeContext.getEntityContext().structureContext;
    const payload = coerceAnalysisPayload(repo.analyses[0]);

    if (structure == null || structureContext == null || payload == null) return [];

    const docs = await analysisRepo.loadLatestDocumentsWithContent(db, repoId, aid);
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
