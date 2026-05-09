import { z } from "zod";

import { StatusSchema } from "@/generated/zod";

export const DashboardStatsSchema = z.object({
  analysisStats: z.object({
    failed: z.number(),
    new: z.number(),
    pending: z.number(),
    success: z.number(),
    total: z.number(),
  }),
  highlights: z.object({
    mostCritical: z.object({ name: z.string(), score: z.number() }).nullable(),
    topPerformer: z.object({ name: z.string(), score: z.number() }).nullable(),
  }),
  languages: z.array(
    z.object({
      color: z.string(),
      name: z.string(),
      value: z.number(),
    })
  ),
  overview: z.object({
    avgScores: z.object({
      complexity: z.number(),
      health: z.number(),
      onboarding: z.number(),
      security: z.number(),
      techDebt: z.number(),
    }),
    complexityDelta: z.number(),
    criticalRepoCount: z.number(),
    docsCount: z.number(),
    healthDelta: z.number(),
    onboardingDelta: z.number(),
    repoCount: z.number(),
    securityDelta: z.number(),
    techDebtDelta: z.number(),
    totalLoc: z.number(),
  }),
  recentActivity: z.array(
    z.object({
      createdAt: z.date(),
      id: z.uuid(),
      progress: z.number(),
      repoName: z.string(),
      repoOwner: z.string(),
      status: StatusSchema,
    })
  ),
  risks: z.object({
    busFactorRepos: z.number(),
    topCoupling: z.array(
      z.object({
        commits: z.number(),
        from_path: z.string(),
        repo_name: z.string(),
        to_path: z.string(),
      })
    ),
    topHotspots: z.array(
      z.object({
        path: z.string(),
        repo_name: z.string(),
        score: z.number(),
      })
    ),
  }),
});

export const TrendsSchema = z.array(
  z.object({
    complexity: z.number(),
    date: z.string(),
    fullDate: z.string(),
    health: z.number(),
    onboarding: z.number(),
    security: z.number(),
    techDebt: z.number(),
  })
);

export const AnalyticsInputSchema = z.object({
  from: z.date().optional(),
  period: z.string().optional().default("30d"),
  repoId: z.string().optional(),
  to: z.date().optional(),
});

export type AnalyticsInput = z.infer<typeof AnalyticsInputSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type Trends = z.infer<typeof TrendsSchema>;
