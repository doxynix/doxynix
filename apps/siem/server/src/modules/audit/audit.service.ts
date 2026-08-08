import type { PaginatedResponse } from "@doxynix/siem-shared";
import { db } from "@server/core/db/db";
import { executePaginatedQuery } from "@server/core/db/pagination";
import { type AuditLogSelect, auditLogs } from "@server/core/db/schema";
import { combineConditions, ilikeIf } from "@server/core/db/utils";
import type { RequestContext } from "@server/utils/request-context";
import { desc } from "drizzle-orm";
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
      actor,
      action,
      target,
      ipAddress: ctx.ip,
      country: ctx.country,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
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
    table: auditLogs,
    whereClause: combineConditions(
      ilikeIf(auditLogs.actor, actor),
      ilikeIf(auditLogs.action, action),
    ),
    orderBy: [desc(auditLogs.createdAt), desc(auditLogs.id)],
    page,
    limit,
  });
}
