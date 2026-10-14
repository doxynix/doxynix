import { BannedEmailReason, MAX_PAGE } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import { appLogger } from "@/server/core/app-logger";
import type { DbClient } from "@/server/core/db";
import { revokeAccessForEmail } from "@/server/utils/access-revocation";
import { normalizeEmail } from "@/server/utils/email-guard";
import { handlePrismaError } from "@/server/utils/handle-error";
import {
  buildDateRangeWhere,
  cappedCount,
  getPaginatedList,
  ORDER_CREATED_AT_DESC,
} from "@/server/utils/pagination";
import { normalizeSearchInput } from "@/server/utils/search";

import type { BannedEmailCreateInput, BannedEmailFilterInput } from "./banned-email.schemas";

const NOT_FOUND = "Banned email not found";
const REASON_DEFAULT: BannedEmailReason = BannedEmailReason.MANUAL;

const BANNED_EMAIL_SELECT = {
  createdAt: true,
  email: true,
  id: true,
  reason: true,
} satisfies Prisma.BannedEmailSelect;

type BannedEmailRow = Prisma.BannedEmailGetPayload<{ select: typeof BANNED_EMAIL_SELECT }>;

function toSummary(row: BannedEmailRow) {
  return {
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    reason: row.reason,
  };
}

function buildSearchClause(term: string) {
  return { email: { contains: term, mode: "insensitive" as const } };
}

export const bannedEmailService = {
  buildWhereClause(filters: Partial<BannedEmailFilterInput>) {
    const term = normalizeSearchInput(filters.search);

    return {
      ...(filters.reason != null ? { reason: filters.reason } : {}),
      ...buildDateRangeWhere(filters, "createdAt"),
      ...(term != null ? buildSearchClause(term) : {}),
    };
  },

  async create(db: DbClient, input: BannedEmailCreateInput) {
    const email = normalizeEmail(input.email);

    try {
      const row = await db.bannedEmail.create({
        data: { email, reason: input.reason ?? REASON_DEFAULT },
        select: BANNED_EMAIL_SELECT,
      });

      const revoked = await revokeAccessForEmail(db, email);

      if (revoked > 0) {
        appLogger.warn({ msg: "Revoked access of newly blocked email", revoked });
      }

      return toSummary(row);
    } catch (error) {
      return handlePrismaError(error, {
        notFound: NOT_FOUND,
        uniqueConstraint: { emailHash: "This email is already blocked" },
      });
    }
  },

  async getAll(db: DbClient, input: BannedEmailFilterInput) {
    const { limit } = input;
    const where = this.buildWhereClause(input);
    const isUnfiltered = Object.keys(where).length === 0;

    const cap = MAX_PAGE * limit;
    const countMatching = (filterWhere: Prisma.BannedEmailWhereInput) =>
      cappedCount(
        (take) => db.bannedEmail.findMany({ select: { id: true }, take, where: filterWhere }),
        cap,
      );

    const { items, meta } = await getPaginatedList({
      countCap: cap,
      countFiltered: () => countMatching(where),
      countUnfiltered: isUnfiltered ? null : () => countMatching({}),
      fetchItems: ({ skip, take }) =>
        db.bannedEmail.findMany({
          orderBy: ORDER_CREATED_AT_DESC,
          select: BANNED_EMAIL_SELECT,
          skip,
          take,
          where,
        }),
      input: { ...input, limit },
    });

    return { items: items.map(toSummary), meta };
  },

  async remove(db: DbClient, id: string) {
    try {
      await db.bannedEmail.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      return handlePrismaError(error, { notFound: NOT_FOUND });
    }
  },
};
