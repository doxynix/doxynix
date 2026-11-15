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

  it("rejects an inverted date range on both schemas", () => {
    const from = new Date("2026-02-01T00:00:00.000Z");
    const to = new Date("2026-01-01T00:00:00.000Z");

    expect(NotificationsFilterSchema.safeParse({ from, to }).success).toBe(false);
    expect(NotificationsBulkFilterSchema.safeParse({ from, to }).success).toBe(false);
  });

  it("keeps from/to in the bulk filter so bulk actions match the list window", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-31T00:00:00.000Z");

    expect(NotificationsBulkFilterSchema.parse({ from, to })).toStrictEqual({ from, to });
  });
});
