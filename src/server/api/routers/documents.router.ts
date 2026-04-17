import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { DocumentFormatter } from "@/server/features/analyze-repo/lib/section-graph-linker";
import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import { prisma } from "@/server/shared/infrastructure/db";
import { DocTypeSchema } from "@/generated/zod";

export const documentsRouter = createTRPCRouter({
  /**
   * Get document content by type
   */
  getByType: protectedProcedure
    .input(
      z.object({
        docType: DocTypeSchema,
        repoId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return prisma.document.findUnique({
        where: {
          repoId_version_type: {
            repoId: input.repoId,
            type: input.docType,
            version: "1.0",
          },
        },
      });
    }),

  /**
   * Get document with graph node links
   */
  getWithGraphLinks: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        docType: DocTypeSchema,
        repoId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const document = await prisma.document.findUnique({
        where: {
          repoId_version_type: {
            repoId: input.repoId,
            type: input.docType,
            version: "1.0", // Latest
          },
        },
      });

      if (!document) {
        throw new Error("Document not found");
      }

      const analysis = await ctx.db.analysis.findUnique({
        select: { resultJson: true },
        where: { id: input.analysisId },
      });

      // Get dependency graph for linking
      const aiResult = analysis?.resultJson as AIResult | null;
      const graph =
        aiResult?.analysisRuntime?.mapper?.status === "success"
          ? (aiResult as any).dependencyGraph
          : {};

      // Format with graph links
      const formatted = DocumentFormatter.withGraphLinks(
        document.content,
        graph,
        input.docType,
        document.version
      );

      return {
        ...document,
        sections: formatted.sections,
      };
    }),

  /**
   * List all documents for repo
   */
  listByRepository: protectedProcedure
    .input(z.object({ repoId: z.number() }))
    .query(async ({ input }) => {
      return prisma.document.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          createdAt: true,
          id: true,
          publicId: true,
          type: true,
          updatedAt: true,
          version: true,
        },
        where: { repoId: input.repoId },
      });
    }),
});
