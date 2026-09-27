import { NotificationSchema, NotifyType } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { notificationMapper } from "@/server/modules/notifications/notification.mapper";

function makeNotificationRow(overrides?: Record<string, unknown>) {
  return {
    body: "Analysis finished",
    createdAt: new Date("2025-03-01T10:00:00Z"),
    id: 42,
    isRead: false,
    publicId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    repo: { name: "test-repo", owner: "test-owner" },
    repoId: 7,
    title: "Analysis done",
    type: NotifyType.SUCCESS,
    updatedAt: new Date("2025-03-01T10:05:00Z"),
    userId: 1,
    ...overrides,
  };
}

const EXPECTED_PUBLIC_KEYS = [
  "body",
  "createdAt",
  "id",
  "isRead",
  "repo",
  "title",
  "type",
  "updatedAt",
];

describe("notificationMapper.toPublic", () => {
  it("should map publicId to id", () => {
    const row = makeNotificationRow();

    expect(notificationMapper.toPublic(row).id).toBe(row.publicId);
  });

  it("should leak no internal column", () => {
    const result = notificationMapper.toPublic(makeNotificationRow());

    expect(Object.keys(result).sort()).toStrictEqual(EXPECTED_PUBLIC_KEYS);
    expect(result).not.toHaveProperty("publicId");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("repoId");
  });

  it("should be an exact allowlist matching NotificationSchema", () => {
    const result = notificationMapper.toPublic(makeNotificationRow());

    expect(Object.keys(result).sort()).toStrictEqual(Object.keys(NotificationSchema.shape).sort());
    expect(() => NotificationSchema.parse(result)).not.toThrow();
  });

  it("should map only the selected repo fields", () => {
    const result = notificationMapper.toPublic(
      makeNotificationRow({ repo: { name: "test-repo", owner: "test-owner", publicId: "leak" } }),
    );

    expect(result.repo).toStrictEqual({ name: "test-repo", owner: "test-owner" });
  });

  it("should keep a missing repo as null", () => {
    const result = notificationMapper.toPublic(makeNotificationRow({ repo: null }));

    expect(result.repo).toBeNull();
  });
});

describe("notificationMapper.toPaginatedList", () => {
  const meta = {
    currentPage: 1,
    filteredCount: 2,
    pageSize: 10,
    totalCount: 2,
    totalPages: 1,
  };

  it("should map every item and pass the meta through", () => {
    const rows = [makeNotificationRow(), makeNotificationRow({ publicId: "other-id" })];

    const result = notificationMapper.toPaginatedList(rows, meta);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id)).toStrictEqual([
      "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      "other-id",
    ]);
    expect(result.meta).toBe(meta);
  });

  it("should leak no internal column on any item", () => {
    const result = notificationMapper.toPaginatedList([makeNotificationRow()], meta);

    for (const item of result.items) {
      expect(Object.keys(item).sort()).toStrictEqual(EXPECTED_PUBLIC_KEYS);
    }
  });
});
