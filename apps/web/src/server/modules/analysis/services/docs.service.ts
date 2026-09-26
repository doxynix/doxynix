import { unstable_cache } from "next/cache";
import { type DocType, DocTypeSchema } from "@doxynix/shared";
import { TRPCError } from "@trpc/server";
import type { Redis } from "@upstash/redis";
import { extname } from "pathe";
import * as z from "zod";

import { highlightCode } from "@/shared/lib/shiki";

import type { DbClient } from "@/server/core/db";
import { resolveDocumentMaterializedPath } from "@/server/utils/document-materialization";
import { markdownToHtml } from "@/server/utils/markdown-to-html";
import { REDIS_CONFIG } from "@/server/utils/redis";

import { analysisMapper } from "../analysis.mapper";
import { analysisRepo } from "../analysis.repository";
import type { AIResult } from "../engine/core/analysis-result.schemas";
import { DocumentFormatter } from "../logic/section-graph-linker";

export const GetWithGraphLinksInput = z.object({
  analysisId: z.number(),
  docType: DocTypeSchema,
  repoId: z.number(),
});

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
          publicId: repoId,
        },
        type,
        ...(path != null ? { path } : {}),
        ...(path == null && {
          analysis: {
            publicId: analysis.publicId,
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
      [`doc-html-${doc.publicId}`],
      {
        revalidate: false,
        tags: ["docs", doc.publicId],
      },
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

  async getWithGraphLinks(db: DbClient, input: z.infer<typeof GetWithGraphLinksInput>) {
    const document = await db.document.findFirst({
      where: {
        analysisId: input.analysisId,
        repoId: input.repoId,
        type: input.docType,
      },
    });

    if (document == null) {
      throw new Error("Document not found");
    }

    const analysis = await db.analysis.findUnique({
      select: { metricsJson: true, resultJson: true },
      where: { id: input.analysisId },
    });

    const aiResult = analysis?.resultJson as AIResult | null;
    const graph =
      (aiResult as any)?.dependencyGraph ?? (analysis?.metricsJson as any)?.dependencyGraph ?? {};
    const formatted = DocumentFormatter.withGraphLinks(
      document.content,
      graph,
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
    const cachedData = await redis.get<any>(cacheKey);

    if (cachedData == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Audit result expired or not found. Please run audit again.",
      });
    }

    const { analysisId, commitSha } = cachedData.contentRef ?? {};

    let internalAnalysisId: number | undefined;
    if (analysisId != null) {
      const analysis = await db.analysis.findUnique({
        select: { id: true },
        where: { publicId: analysisId },
      });
      internalAnalysisId = analysis?.id;
    }

    const markdownContent = cachedData.content;

    return db.document.create({
      data: {
        content: markdownContent,
        path: input.path,
        repo: { connect: { publicId: input.repoId } },
        type: "CODE_DOC",
        version: commitSha ?? "manual",
        ...(internalAnalysisId != null
          ? {
              analysis: { connect: { id: internalAnalysisId } },
            }
          : {}),
      },
    });
  },
};
