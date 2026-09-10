import { trpc } from "@/core/client";

import type { AuditLogsQueryInput } from "./audit.types";

export const auditService = {
  async getActivityLogs(input?: AuditLogsQueryInput) {
    return trpc.audit.getActivityLogs.query(input ?? {});
  },

  async getLogPayloadHtml(logId: string) {
    return trpc.audit.getLogPayloadHtml.query({ logId });
  },
};
