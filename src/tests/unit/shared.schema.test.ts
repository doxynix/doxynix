import { describe, expect, it } from "vitest";

import {
  NotificationsBulkFilterSchema,
  NotificationsFilterSchema,
  RepoFilterSchema,
} from "@/server/trpc/shared";

describe("shared schemas", () => {
  it("rejects notification repo filters when only one identity field is provided", () => {
    expect(NotificationsFilterSchema.safeParse({ repoName: "react-query" }).success).toBe(true);
    expect(NotificationsBulkFilterSchema.safeParse({ repoOwner: "tanstack" }).success).toBe(true);
  });

  it("accepts notification repo filters when name and owner are provided together", () => {
    expect(
      NotificationsFilterSchema.safeParse({
        repoName: "react-query",
        repoOwner: "tanstack",
      }).success
    ).toBe(false);

    expect(
      NotificationsBulkFilterSchema.safeParse({
        repoName: "react-query",
        repoOwner: "tanstack",
      }).success
    ).toBe(false);
  });

  it("rejects invalid repository cursor values", () => {
    expect(RepoFilterSchema.safeParse({ cursor: -1 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ cursor: -100000000000000000 }).success).toBe(false);
    expect(RepoFilterSchema.safeParse({ cursor: 1000001 }).success).toBe(false);
  });
});
