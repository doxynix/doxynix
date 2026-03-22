import type { NotifyType, Prisma } from "@prisma/client";

import { normalizeSearchInput, tokenizeSearchInput } from "../utils/search";

type NotificationSearchFilters = {
  isRead?: boolean;
  repoName?: string;
  repoOwner?: string;
  search?: string;
  type?: NotifyType;
};

function buildNotificationSearchClause(term: string): Prisma.NotificationWhereInput {
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { body: { contains: term, mode: "insensitive" } },
      {
        repo: {
          is: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { owner: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      },
    ],
  };
}

export const notificationsService = {
  buildWhereClause(filters: NotificationSearchFilters): Prisma.NotificationWhereInput {
    const normalizedRepoName = filters.repoName?.trim();
    const normalizedRepoOwner = filters.repoOwner?.trim();
    const normalizedSearch = normalizeSearchInput(filters.search);
    const repoSearchTerms = tokenizeSearchInput(filters.search);

    const rawSearchFilter: Prisma.NotificationWhereInput =
      normalizedSearch != null ? buildNotificationSearchClause(normalizedSearch) : {};

    const tokenSearchFilter: Prisma.NotificationWhereInput =
      repoSearchTerms.length > 1
        ? {
            AND: repoSearchTerms.map((term) => buildNotificationSearchClause(term)),
          }
        : {};

    const searchFilter: Prisma.NotificationWhereInput =
      normalizedSearch != null && repoSearchTerms.length > 1
        ? { OR: [rawSearchFilter, tokenSearchFilter] }
        : rawSearchFilter;

    const repoFilter: Prisma.NotificationWhereInput =
      normalizedRepoOwner != null &&
      normalizedRepoOwner.length > 0 &&
      normalizedRepoName != null &&
      normalizedRepoName.length > 0
        ? {
            repo: {
              is: {
                name: { equals: normalizedRepoName, mode: "insensitive" },
                owner: { equals: normalizedRepoOwner, mode: "insensitive" },
              },
            },
          }
        : {};

    return {
      ...(filters.type != null && { type: filters.type }),
      ...(typeof filters.isRead === "boolean" && { isRead: filters.isRead }),
      ...searchFilter,
      ...repoFilter,
    };
  },
};
