import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import type { DbClient } from "@/server/core/db";
import { AUDIT_BUSINESS_MODELS } from "@/server/utils/constants";
import { keysetArgs, ORDER_CREATED_AT_DESC, splitKeysetPage } from "@/server/utils/pagination";
import { sanitizeObject } from "@/server/utils/sanitize-payload";

import { auditMapper } from "./audit.mapper";

export type ActivityLogsInput = {
  cursor?: null | string;
  limit: number;
};

export const auditService = {
  async getActivityLogs(db: DbClient, userId: string, input: ActivityLogsInput) {
    const { cursor, limit } = input;

    const rows = await db.auditLog.findMany({
      ...keysetArgs(cursor, limit),
      orderBy: ORDER_CREATED_AT_DESC,
      where: {
        model: { in: AUDIT_BUSINESS_MODELS },
        userId,
      },
    });

    const { hasNextPage, items, nextCursor } = splitKeysetPage(rows, limit);

    return {
      items: items.map((item) => auditMapper.toDto(item)),
      meta: {
        hasNextPage,
        nextCursor,
      },
    };
  },

  async getLogPayloadHtml(db: DbClient, userId: string, logId: string) {
    const log = await db.auditLog.findUnique({
      select: { payload: true },
      where: { id: logId, userId },
    });

    if (log == null) {
      // Without a message tRPC substitutes the code, so the client would render the literal string "NOT_FOUND".
      throw new TRPCError({ code: "NOT_FOUND", message: "Audit log not found" });
    }

    const cleanPayload = sanitizeObject(log.payload);
    const jsonString = JSON.stringify(cleanPayload, null, 2);

    return highlightCode(jsonString, "json", "dark", logId);
  },
};
