import { SEVERITY_LEVELS } from "@doxynix/shared";
import { Temporal } from "@js-temporal/polyfill";
import { count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/core/db/db";
import { incidents, rules } from "@/core/db/schema";

import type { DashboardAnalyticsQuery } from "./analytics.schema";

export async function getDashboardAnalytics(query: DashboardAnalyticsQuery) {
  const { days } = query;

  const now = Temporal.Now.instant();
  const startTemporal = now.toZonedDateTimeISO("UTC").subtract({ days }).startOfDay();
  const startDate = new Date(startTemporal.epochMilliseconds);

  const [incidentsStatsTask, activeRulesTask, recentIncidentsTask] = await Promise.all([
    db
      .select({
        critical: sql<number>`count(*) filter (where ${incidents.severity} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${incidents.severity} = 'high')::int`,
        low: sql<number>`count(*) filter (where ${incidents.severity} = 'low')::int`,
        medium: sql<number>`count(*) filter (where ${incidents.severity} = 'medium')::int`,
        total: count(),
        totalFindings: sql<number>`coalesce(sum(${incidents.findingsCount}), 0)::int`,
      })
      .from(incidents)
      .where(gte(incidents.createdAt, startDate)),

    db.select({ count: count() }).from(rules).where(eq(rules.isActive, true)),

    db.query.incidents.findMany({
      limit: 5,
      orderBy: [desc(incidents.createdAt), desc(incidents.id)],
    }),
  ]);

  const [incidentsStats] = incidentsStatsTask;
  const [activeRulesRes] = activeRulesTask;

  const severityBreakdown = SEVERITY_LEVELS.map((severity) => ({
    count: incidentsStats?.[severity] ?? 0,
    severity,
  }));

  return {
    kpis: {
      activeRules: activeRulesRes?.count ?? 0,
      criticalIncidents: incidentsStats?.critical ?? 0,
      totalFindings: incidentsStats?.totalFindings ?? 0,
      totalIncidents: incidentsStats?.total ?? 0,
    },
    recentIncidents: recentIncidentsTask,
    severityBreakdown,
  };
}
