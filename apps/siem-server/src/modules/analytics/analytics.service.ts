import { SEVERITY_LEVELS, type Severity } from "@doxynix/shared";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@server/core/db/db";
import { incidents, rules } from "@server/core/db/schema";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import type { DashboardAnalyticsQuery } from "./analytics.schema";

export async function getDashboardAnalytics(query: DashboardAnalyticsQuery) {
  const { days } = query;

  const now = Temporal.Now.instant();
  const startTemporal = now.toZonedDateTimeISO("UTC").subtract({ days }).startOfDay();
  const startDate = new Date(startTemporal.epochMilliseconds);

  const severitySelectors = Object.fromEntries(
    SEVERITY_LEVELS.map((sev) => [
      sev,
      sql<number>`count(*) filter (where ${incidents.severity} = ${sev})::int`,
    ]),
  ) as Record<Severity, ReturnType<typeof sql<number>>>;

  const [incidentsStatsTask, activeRulesTask, recentIncidentsTask] = await Promise.all([
    db
      .select({
        total: count(),
        totalFindings: sql<number>`coalesce(sum(${incidents.findingsCount}), 0)::int`,
        ...severitySelectors,
      })
      .from(incidents)
      .where(gte(incidents.createdAt, startDate)),

    db.select({ count: count() }).from(rules).where(eq(rules.isActive, true)),

    db.query.incidents.findMany({
      orderBy: [desc(incidents.createdAt), desc(incidents.id)],
      limit: 5,
    }),
  ]);

  const [incidentsStats] = incidentsStatsTask;
  const [activeRulesRes] = activeRulesTask;

  const severityBreakdown = SEVERITY_LEVELS.map((severity) => ({
    severity,
    count: Number(incidentsStats?.[severity] ?? 0),
  }));

  return {
    kpis: {
      totalIncidents: Number(incidentsStats?.total ?? 0),
      criticalIncidents: Number(incidentsStats?.critical ?? 0),
      activeRules: Number(activeRulesRes?.count ?? 0),
      totalFindings: Number(incidentsStats?.totalFindings ?? 0),
    },
    severityBreakdown,
    recentIncidents: recentIncidentsTask,
  };
}
