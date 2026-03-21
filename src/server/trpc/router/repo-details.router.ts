import { unstable_cache } from "next/cache";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { highlightCode } from "@/shared/lib/shiki";

import { aiSchema, type AIResult } from "@/server/ai/schemas";
import type { RepoMetrics } from "@/server/ai/types";
import { markdownToHtml } from "@/server/utils/markdown-to-html";
import { DocTypeSchema } from "@/generated/zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const repoDetailsRouter = createTRPCRouter({
  getAvailableDocs: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const docs = await ctx.db.document.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          publicId: true,
          type: true,
        },
        where: { repo: { publicId: input.repoId } },
      });
      return docs.map((d) => ({
        id: d.publicId,
        type: d.type,
      }));
    }),

  getDetailedMetrics: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const analysis = await ctx.db.analysis.findFirst({
        orderBy: { createdAt: "desc" },
        where: { repo: { publicId: input.repoId }, status: "DONE" },
      });

      if (analysis == null || analysis.resultJson == null) return null;

      const res = aiSchema.parse(analysis.resultJson);

      return {
        apiStructure: res.sections.api_structure,
        bottlenecks: res.mainBottlenecks ?? [],

        dataFlow: res.sections.data_flow,

        onboarding: res.onboarding_guide,

        performance: res.sections.performance,
        refactoringTargets: res.refactoring_targets,
        security: {
          risks: res.sections.security_audit.risks,
          score: res.sections.security_audit.score,
          vulnerabilities: res.vulnerabilities ?? [],
        },

        swagger: res.swaggerYaml,

        techDebt: res.sections.tech_debt,
      };
    }),

  getDocumentContent: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        type: DocTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          repo: { publicId: input.repoId },
          type: input.type,
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

      return { html, id: doc.publicId };
    }),

  getHistory: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.analysis.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          commitSha: true,
          createdAt: true,
          message: true,
          publicId: true,
          score: true,
          status: true,
        },
        where: { repo: { publicId: input.repoId } },
      });

      return history.map((h) => ({
        commitSha: h.commitSha,
        createdAt: h.createdAt,
        id: h.publicId,
        message: h.message,
        score: h.score,
        status: h.status,
      }));
    }),

  getOverview: protectedProcedure
    .input(z.object({ repoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.repo.findUnique({
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { status: "DONE" },
          },
        },
        where: { publicId: input.repoId },
      });

      if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

      const lastAnalysis = repo.analyses[0];
      if (lastAnalysis.resultJson == null || lastAnalysis.metricsJson == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis data is missing" });
      }

      const metrics = lastAnalysis.metricsJson as RepoMetrics;
      const result = lastAnalysis.resultJson as AIResult;

      return {
        description: repo.description,
        languages: metrics.languages,
        maintenance: metrics.maintenanceStatus,
        mostComplexFiles: metrics.mostComplexFiles,
        name: repo.name,
        owner: repo.owner,
        scores: {
          busFactor: metrics.busFactor,
          complexityScore: metrics.complexityScore,
          docDensity: metrics.docDensity,
          healthScore: lastAnalysis.score,
          modularityScore: metrics.modularityIndex,
          onboardingScore: lastAnalysis.onboardingScore,
          securityScore: lastAnalysis.securityScore,
          techDebtScore: lastAnalysis.techDebtScore,
        },
        stats: {
          fileCount: metrics.fileCount,
          linesOfCode: metrics.totalLoc,
          totalSize: `${metrics.totalSizeKb} KB`,
        },
        summary: result.executive_summary,
      };
    }),
  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      const ext = input.path.split(".").pop() ?? "txt";
      const html = await highlightCode(input.content, ext);
      return { html };
    }),
});
