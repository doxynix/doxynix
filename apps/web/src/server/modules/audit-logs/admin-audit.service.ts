import { MAX_PAGE } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import type { DbClient } from "@/server/core/db";
import {
  buildDateRangeWhere,
  cappedCount,
  getPaginatedList,
  ORDER_CREATED_AT_DESC,
} from "@/server/utils/pagination";
import { sanitizeObject } from "@/server/utils/sanitize-payload";
import { normalizeSearchInput } from "@/server/utils/search";

import type { AdminAuditFilterInput } from "./admin-audit.schemas";
import { auditMapper } from "./audit.mapper";

const NOT_FOUND = "Audit log not found";

function normalizeFilters(input: AdminAuditFilterInput) {
  return {
    actorId: input.actorId ?? null,
    from: input.from ?? null,
    model: input.model ?? null,
    operation: input.operation ?? null,
    term: normalizeSearchInput(input.search) ?? null,
    to: input.to ?? null,
  };
}

function buildWhereClause(input: AdminAuditFilterInput): Prisma.AuditLogWhereInput {
  const filters = normalizeFilters(input);

  const range: Prisma.AuditLogWhereInput =
    filters.from != null || filters.to != null
      ? {
          createdAt: {
            ...(filters.from != null ? { gte: filters.from } : {}),
            ...(filters.to != null ? { lte: filters.to } : {}),
          },
        }
      : {};

  return {
    ...(filters.actorId != null ? { userId: filters.actorId } : {}),
    ...range,
    ...buildDateRangeWhere(filters, "createdAt"),
    ...(filters.model != null ? { model: filters.model } : {}),
    ...(filters.operation != null ? { operation: filters.operation } : {}),
    ...(filters.term != null
      ? { requestId: { contains: filters.term, mode: "insensitive" as const } }
      : {}),
  };
}

export const adminAuditService = {
  buildWhereClause,

  async getAll(db: DbClient, input: AdminAuditFilterInput) {
    const { limit } = input;
    const where = buildWhereClause(input);
    const isUnfiltered = Object.keys(where).length === 0;

    const cap = MAX_PAGE * limit;
    const countMatching = (filterWhere: Prisma.AuditLogWhereInput) =>
      cappedCount(
        (take) => db.auditLog.findMany({ select: { id: true }, take, where: filterWhere }),
        cap,
      );

    const { items, meta } = await getPaginatedList({
      countCap: cap,
      countFiltered: () => countMatching(where),
      countUnfiltered: isUnfiltered ? null : () => countMatching({}),
      fetchItems: ({ skip, take }) =>
        db.auditLog.findMany({
          orderBy: ORDER_CREATED_AT_DESC,
          skip,
          take,
          where,
        }),
      input: { ...input, limit },
    });

    return { items: items.map((item) => auditMapper.toDto(item)), meta };
  },

  async getDetail(db: DbClient, id: string) {
    const log = await db.auditLog.findUnique({ where: { id } });

    if (log == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND });
    }

    return auditMapper.toDto(log);
  },

  async getPayloadHtml(db: DbClient, id: string) {
    const log = await db.auditLog.findUnique({
      select: { id: true, payload: true },
      where: { id },
    });

    if (log == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND });
    }

    return highlightCode(JSON.stringify(sanitizeObject(log.payload), null, 2), "json", "dark", id);
  },
};
