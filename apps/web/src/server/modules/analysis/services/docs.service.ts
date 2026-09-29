import { unstable_cache } from "next/cache";
import { type DocType, DocTypeSchema } from "@doxynix/shared";
import { TRPCError } from "@trpc/server";
import type { Redis } from "@upstash/redis";
import { extname } from "pathe";
import * as z from "zod";

import { highlightCode } from "@/shared/lib/shiki";

import type { DbClient } from "@/server/core/db";
import type { FileActionPreviewResult } from "@/server/core/redis.types";
import { resolveDocumentMaterializedPath } from "@/server/utils/document-materialization";
import { markdownToHtml } from "@/server/utils/markdown-to-html";
import { REDIS_CONFIG } from "@/server/utils/redis";

import { analysisMapper } from "../analysis.mapper";
import { analysisRepo } from "../analysis.repository";
import { DocumentFormatter } from "../logic/section-graph-linker";

export const GetWithGraphLinksInput = z.object({
  analysisId: z.uuid(),
  docType: DocTypeSchema,
  repoId: z.uuid(),
});

const DocumentSectionSchema = z.object({
  content: z.string(),
  endLine: z.number().optional(),
  graphNodeIds: z.array(z.string()),
  id: z.string(),
  startLine: z.number().optional(),
  title: z.string(),
});

export const GetWithGraphLinksOutput = z.object({
  content: z.string(),
  createdAt: z.date(),
  id: z.uuid(),
  path: z.string().nullable(),
  sections: z.array(DocumentSectionSchema),
  type: z.string(),
  updatedAt: z.date(),
  version: z.string(),
});

export type GetWithGraphLinksOutput = z.infer<typeof GetWithGraphLinksOutput>;

export const PinAuditToDocsOutput = z.object({
  documentId: z.uuid(),
});

export type PinAuditToDocsOutput = z.infer<typeof PinAuditToDocsOutput>;

export const docsService = {
  async getAvailableDocs(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return [];
    }
    return analysisMapper.toAvailableDocs(repo);
  },

  async getDocumentContent(
    db: DbClient,
    repoId: string,
    type: DocType,
    aid?: string,
    path?: string,
  ) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
    }
    const analysis = repo.analyses[0];

    if (analysis == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
    }

    const doc = await db.document.findFirst({
      where: {
        repo: {
          id: repoId,
        },
        type,
        ...(path != null ? { path } : {}),
        ...(path == null && {
          analysis: {
            id: analysis.id,
          },
        }),
      },
    });

    if (doc == null) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const html = await unstable_cache(
      async () =>
        markdownToHtml({
          content: doc.content,
          name: repo.name,
          owner: repo.owner,
        }),
      [`doc-html-${doc.id}`],
      {
        revalidate: false,
        tags: ["docs", doc.id],
      },
    )();

    return {
      html,
      id: doc.id,
      materializedPath: resolveDocumentMaterializedPath({
        sourcePath: doc.path,
        type: doc.type,
      }),
      raw: doc.content,
      sourcePath: doc.path,
    };
  },

  async getWithGraphLinks(db: DbClient, input: z.infer<typeof GetWithGraphLinksInput>) {
    const document = await db.document.findFirst({
      select: {
        content: true,
        createdAt: true,
        id: true,
        path: true,
        type: true,
        updatedAt: true,
        version: true,
      },
      where: {
        analysisId: input.analysisId,
        repoId: input.repoId,
        type: input.docType,
      },
    });

    if (document == null) {
      throw new Error("Document not found");
    }

    // Graph links are not built here. `RepositoryEvidence.dependencyGraph` is
    // computed per analysis but never persisted to `resultJson` or
    // `metricsJson`, so reading it back from either column has always yielded
    // `undefined` and the caller's `graph?.nodes` guard has always short-circuited.
    // `withGraphLinks` accepts `null` for exactly this case.
    //
    // The two live callers of the linker do pass a real graph and are unaffected:
    // `workspace-search.service` reads `structure.graph` from the analyze
    // context, and `doc-section-matcher` receives one. This service has no access
    // to the analyze context, so it passes `null`. Persisting the graph to enable
    // links here is tracked separately.
    const formatted = DocumentFormatter.withGraphLinks(
      document.content,
      null,
      input.docType,
      document.version,
    );

    return {
      ...document,
      sections: formatted.sections,
    };
  },

  async highlightFile(content: string, path: string) {
    const ext = extname(path).slice(1).toLowerCase() || "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },

  async pinAuditToDocs(
    db: DbClient,
    redis: Redis,
    userId: string,
    input: { path: string; repoId: string },
  ) {
    const cacheKey = REDIS_CONFIG.keys.fileAction(userId, input.path, "quick-file-audit");
    const cachedData = await redis.get<FileActionPreviewResult>(cacheKey);

    if (cachedData == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Audit result expired or not found. Please run audit again.",
      });
    }

    const { analysisId, commitSha } = cachedData;

    let internalAnalysisId: string | undefined;
    if (analysisId != null) {
      const analysis = await db.analysis.findUnique({
        select: { id: true },
        where: { id: analysisId },
      });
      internalAnalysisId = analysis?.id;
    }

    const markdownContent = cachedData.content;

    const document = await db.document.create({
      data: {
        content: markdownContent,
        path: input.path,
        repo: { connect: { id: input.repoId } },
        type: "CODE_DOC",
        version: commitSha ?? "manual",
        ...(internalAnalysisId != null
          ? {
              analysis: { connect: { id: internalAnalysisId } },
            }
          : {}),
      },
      select: { id: true },
    });

    return { documentId: document.id };
  },
};
