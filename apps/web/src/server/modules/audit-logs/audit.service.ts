import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import type { DbClient } from "@/server/core/db";
import { AUDIT_BUSINESS_MODELS } from "@/server/utils/constants";
import { sanitizeObject } from "@/server/utils/sanitize-payload";

import { auditMapper } from "./audit.mapper";

export type ActivityLogsInput = {
  cursor?: null | string;
  limit: number;
};

export const auditService = {
  async getActivityLogs(db: DbClient, userId: string, input: ActivityLogsInput) {
    const { cursor, limit } = input;

    const items = await db.auditLog.findMany({
      cursor: cursor != null ? { id: cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      where: {
        model: { in: AUDIT_BUSINESS_MODELS },
        userId,
      },
    });

    let nextCursor: string | undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items: items.map((item) => auditMapper.toDto(item)),
      nextCursor,
    };
  },

  async getLogPayloadHtml(db: DbClient, userId: string, logId: string) {
    const log = await db.auditLog.findUnique({
      select: { payload: true },
      where: { id: logId, userId },
    });

    if (log == null) {
      // Without a message tRPC substitutes the code, so the client rendered the
      // literal string "NOT_FOUND" to the user.
      throw new TRPCError({ code: "NOT_FOUND", message: "Audit log not found" });
    }

    const cleanPayload = sanitizeObject(log.payload);
    const jsonString = JSON.stringify(cleanPayload, null, 2);

    return highlightCode(jsonString, "json", "dark", logId);
  },
};
