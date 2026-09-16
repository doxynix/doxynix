import { describe, expect, it } from "vitest";

import { NotificationsBulkFilterSchema, NotificationsFilterSchema } from "./notification.schemas";

describe("notification.schemas", () => {
  it("rejects notification repo filters when only one identity field is provided", () => {
    expect(NotificationsFilterSchema.safeParse({ repoName: "react-query" }).success).toBe(false);
    expect(NotificationsBulkFilterSchema.safeParse({ repoOwner: "tanstack" }).success).toBe(false);
  });

  it("accepts notification repo filters when name and owner are provided together", () => {
    expect(
      NotificationsFilterSchema.safeParse({
        repoName: "react-query",
        repoOwner: "tanstack",
      }).success,
    ).toBe(true);

    expect(
      NotificationsBulkFilterSchema.safeParse({
        repoName: "react-query",
        repoOwner: "tanstack",
      }).success,
    ).toBe(true);
  });
});
