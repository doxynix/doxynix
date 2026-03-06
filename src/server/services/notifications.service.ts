import type { NotifyType, Prisma } from "@prisma/client";

export const notificationsService = {
  buildWhereClause(filters: {
    isRead?: boolean;
    repoName?: string;
    repoOwner?: string;
    search?: string;
    type?: NotifyType;
  }): Prisma.NotificationWhereInput {
    const { isRead, repoName, repoOwner, search, type } = filters;
    const normalizedSearch = search?.trim();
    const searchTerms = normalizedSearch != null ? normalizedSearch.split(/\s+/) : [];

    const searchFilter: Prisma.NotificationWhereInput =
      searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { title: { contains: term, mode: "insensitive" } },
                { body: { contains: term, mode: "insensitive" } },
              ],
            })),
          }
        : {};

    return {
      ...searchFilter,
      isRead: isRead ?? undefined,
      repo:
        repoOwner != null && repoName != null
          ? {
              name: { equals: repoName, mode: "insensitive" },
              owner: { equals: repoOwner, mode: "insensitive" },
            }
          : undefined,
      type: type ?? undefined,
    };
  },
};
