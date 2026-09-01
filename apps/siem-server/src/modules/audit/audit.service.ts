import type { PaginatedResponse } from "@doxynix/shared";
import { desc } from "drizzle-orm";

import { db } from "@/core/db/db";
import { executePaginatedQuery } from "@/core/db/pagination";
import { type AuditLogSelect, auditLogs } from "@/core/db/schema";
import { combineConditions, ilikeIf } from "@/core/db/utils";
import type { RequestContext } from "@/utils/request-context";

import type { GetAuditLogsQuery } from "./audit.schema";

export type RecordAuditInput = {
  actor: string;
  action: string;
  target: string;
  ctx: RequestContext;
};

export async function recordAuditLog(input: RecordAuditInput): Promise<void> {
  const { actor, action, target, ctx } = input;

  await db
    .insert(auditLogs)
    .values({
      action,
      actor,
      country: ctx.country,
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
      target,
      userAgent: ctx.userAgent,
    })
    .catch((error) => {
      console.error("[Audit Service] Failed to write audit log entry:", error);
    });
}

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
