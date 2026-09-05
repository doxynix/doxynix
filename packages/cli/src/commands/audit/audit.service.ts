import { trpc } from "@/core/client";

export const auditService = {
  async getActivityLogs(limit = 20, cursor?: string) {
    return trpc.audit.getActivityLogs.query({
      cursor,
      limit,
    });
  },
};
