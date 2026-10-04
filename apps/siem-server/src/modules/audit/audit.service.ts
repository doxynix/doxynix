import { desc } from "drizzle-orm";

import { executePaginatedQuery, type PaginatedResponse } from "@/core/db/pagination";
import { type AuditLogSelect, auditLogs } from "@/core/db/schema";
import { combineConditions, ilikeIf } from "@/core/db/utils";

import type { GetAuditLogsQuery } from "./audit.schema";

export async function getAuditLogsList(
  query: GetAuditLogsQuery,
): Promise<PaginatedResponse<AuditLogSelect>> {
  const { page, limit, actor, action } = query;

  return executePaginatedQuery({
    limit,
    orderBy: [desc(auditLogs.createdAt), desc(auditLogs.id)],
    page,
    table: auditLogs,
    whereClause: combineConditions(
      ilikeIf(auditLogs.actor, actor),
      ilikeIf(auditLogs.action, action),
    ),
  });
}
