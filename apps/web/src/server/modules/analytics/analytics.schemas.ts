import { StatusSchema } from "@doxynix/shared";
import * as z from "zod";

import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
  MAX_CUSTOM_RANGE_DAYS,
} from "@/shared/lib/analytics-periods";

import { dateRangeMustBeOrdered } from "@/server/utils/pagination";

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
    }),
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
      createdAt: z.coerce.date(),
      id: z.uuid(),
      progress: z.number(),
      repoName: z.string(),
      repoOwner: z.string(),
      status: StatusSchema,
    }),
  ),
  risks: z.object({
    busFactorRepos: z.number(),
    topCoupling: z.array(
      z.object({
        commits: z.number(),
        from_path: z.string(),
        repo_name: z.string(),
        to_path: z.string(),
      }),
    ),
    topHotspots: z.array(
      z.object({
        path: z.string(),
        repo_name: z.string(),
        score: z.number(),
      }),
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
  }),
);

const MAX_CUSTOM_RANGE_MS = MAX_CUSTOM_RANGE_DAYS * 86_400_000;

export const AnalyticsPeriodSchema = z.enum(ANALYTICS_PERIODS);

// U6: `custom` is the only period that can reach `from=1970`, so it is the only one capped.
function customRangeIssues(
  data: { from?: Date; period: AnalyticsPeriod; to?: Date },
  ctx: z.RefinementCtx,
) {
  if (data.period !== "custom") {
    return;
  }

  if (data.from == null) {
    ctx.addIssue({
      code: "custom",
      message: "A custom range needs a start date",
      path: ["from"],
    });
    return;
  }

  // `to` is optional and the service falls back to now, so that is the span it would really query.
  const spanMs = (data.to ?? new Date()).getTime() - data.from.getTime();

  if (spanMs > MAX_CUSTOM_RANGE_MS) {
    ctx.addIssue({
      code: "custom",
      message: `A custom range cannot span more than ${MAX_CUSTOM_RANGE_DAYS} days`,
      path: ["to"],
    });
  }
}

export const AnalyticsInputSchema = z
  .object({
    from: z.date().optional(),
    period: AnalyticsPeriodSchema.default("30d"),
    repoId: z.string().optional(),
    to: z.date().optional(),
  })
  .superRefine(dateRangeMustBeOrdered)
  .superRefine(customRangeIssues);

export type AnalyticsInput = z.infer<typeof AnalyticsInputSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type Trends = z.infer<typeof TrendsSchema>;
