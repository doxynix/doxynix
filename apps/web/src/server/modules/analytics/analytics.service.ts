import { getDashboardStats, getTrends } from "@prisma/client/sql";
import { subDays, subHours, subMinutes } from "date-fns";

import type { DbClient } from "@/server/core/db";

import {
  DashboardStatsSchema,
  type AnalyticsInput,
  type DashboardStats,
  type Trends,
} from "./analytics.schemas";

export const analyticsService = {
  calculatePeriodStart(period: string, relativeTo: Date): Date {
    switch (period) {
      case "15m": {
        return subMinutes(relativeTo, 15);
      }
      case "1h": {
        return subHours(relativeTo, 1);
      }
      case "24h": {
        return subDays(relativeTo, 1);
      }
      case "7d": {
        return subDays(relativeTo, 7);
      }
      case "90d": {
        return subDays(relativeTo, 90);
      }
      case "30d":
      default: {
        return subDays(relativeTo, 30);
      }
    }
  },

  async getDashboardStats(
    db: DbClient,
    input: AnalyticsInput,
    userId: number
  ): Promise<DashboardStats> {
    const now = new Date();

    let currentStart: Date;
    let currentEnd: Date = input.to ?? now;

    if (input.period !== "custom") {
      currentEnd = now;
      currentStart = this.calculatePeriodStart(input.period, currentEnd);
    } else {
      currentStart = input.from ?? subDays(currentEnd, 30);
    }

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - durationMs);

    const [data] = await db.$queryRawTyped(
      getDashboardStats(userId, currentStart, previousStart, currentEnd)
    );

    if (data == null) {
      return this.getEmptyDashboardStats();
    }

    return DashboardStatsSchema.parse({
      analysisStats: {
        failed: data.failedCount ?? 0,
        new: data.newCount ?? 0,
        pending: data.pendingCount ?? 0,
        success: data.successCount ?? 0,
        total: data.totalCount ?? 0,
      },
      highlights: {
        mostCritical: data.worstRepo,
        topPerformer: data.bestRepo,
      },
      languages: data.languages ?? [],
      overview: {
        avgScores: {
          complexity: Math.round(data.avgComplexity ?? 0),
          health: Math.round(data.avgHealth ?? 0),
          onboarding: Math.round(data.avgOnboarding ?? 0),
          security: Math.round(data.avgSecurity ?? 0),
          techDebt: Math.round(data.avgTechDebt ?? 0),
        },
        complexityDelta: data.complexityDelta ?? 0,
        criticalRepoCount: data.criticalRepoCount ?? 0,
        docsCount: data.docCount ?? 0,
        healthDelta: data.healthDelta ?? 0,
        onboardingDelta: data.onboardingDelta ?? 0,
        repoCount: data.repoCount ?? 0,
        securityDelta: data.securityDelta ?? 0,
        techDebtDelta: data.techDebtDelta ?? 0,
        totalLoc: data.totalLoc ?? 0,
      },
      recentActivity: (data.recentActivity as Record<string, unknown>[]).map((activity) => ({
        ...activity,
      })),
      risks: {
        busFactorRepos: data.busFactorRepos ?? 0,
        topCoupling: data.topCoupling ?? [],
        topHotspots: data.topHotspots ?? [],
      },
    });
  },

  getEmptyDashboardStats() {
    return {
      analysisStats: { failed: 0, new: 0, pending: 0, success: 0, total: 0 },
      highlights: { mostCritical: null, topPerformer: null },
      languages: [],
      overview: {
        avgScores: {
          complexity: 0,
          health: 0,
          onboarding: 0,
          security: 0,
          techDebt: 0,
        },
        complexityDelta: 0,
        criticalRepoCount: 0,
        docsCount: 0,
        healthDelta: 0,
        onboardingDelta: 0,
        repoCount: 0,
        securityDelta: 0,
        techDebtDelta: 0,
        totalLoc: 0,
      },
      recentActivity: [],
      risks: { busFactorRepos: 0, topCoupling: [], topHotspots: [] },
    };
  },

  async getTrends(db: DbClient, input: AnalyticsInput, userId: number): Promise<Trends> {
    let startDate: Date;
    let endDate = input.to ?? new Date();

    if (input.period !== "custom") {
      endDate = new Date();
      startDate = this.calculatePeriodStart(input.period, endDate);
    } else {
      startDate = input.from ?? subDays(endDate, 30);
    }

    const trends = await db.$queryRawTyped(
      getTrends(userId, startDate, endDate, input.repoId ?? null)
    );

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    return trends.map((t) => {
      const dateKey = t.dateKey ?? new Date();

      return {
        complexity: t.complexity ?? 0,
        date: dateFormatter.format(dateKey),
        fullDate: dateKey.toISOString().slice(0, 10),
        health: t.health ?? 0,
        onboarding: t.onboarding ?? 0,
        security: t.security ?? 0,
        techDebt: t.techDebt ?? 0,
      };
    });
  },
};
