import { db } from "@/core/db/db";
import { auditLogs } from "@/core/db/schema";
import type { RequestContext } from "@/utils/request-context";

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
