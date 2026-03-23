import { NotifyType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { notificationsService } from "@/server/services/notifications.service";

function buildSearchClause(term: string) {
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

describe("notificationsService.buildWhereClause", () => {
  it("should return empty object when filters are not provided", () => {
    expect(notificationsService.buildWhereClause({})).toEqual({});
  });

  it("should combine raw and tokenized search filters for slug-like input", () => {
    const where = notificationsService.buildWhereClause({
      search: "  @tanstack/react-query  ",
    });

    expect(where).toEqual({
      OR: [
        buildSearchClause("@tanstack/react-query"),
        {
          AND: [
            buildSearchClause("tanstack"),
            buildSearchClause("react"),
            buildSearchClause("query"),
          ],
        },
      ],
    });
  });

  it("should build exact repo filter and primitive filters", () => {
    const where = notificationsService.buildWhereClause({
      isRead: false,
      repoName: "react-query",
      repoOwner: "TanStack",
      type: NotifyType.WARNING,
    });

    expect(where).toEqual({
      isRead: false,
      repo: {
        is: {
          name: { equals: "react-query", mode: "insensitive" },
          owner: { equals: "TanStack", mode: "insensitive" },
        },
      },
      type: NotifyType.WARNING,
    });
  });
});
