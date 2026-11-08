import { describe, expect, it } from "vitest";

import type {
  FeedData,
  NotificationGetAll,
} from "@/entities/notification/model/notifications.types";

import { patchMarkAllFeed, patchMarkAllList, patchMarkAllStats } from "./notification-cache";

const note = (id: string, isRead: boolean) => ({ id, isRead }) as never;

const stats = { read: 3, total: 10, unread: 7 };

describe("patchMarkAllStats", () => {
  it("zeroes the unread counter", () => {
    expect(patchMarkAllStats(stats)).toEqual({ read: 3, total: 10, unread: 0 });
  });

  it("passes through missing stats", () => {
    expect(patchMarkAllStats(undefined)).toBeUndefined();
  });
});

describe("patchMarkAllList", () => {
  it("marks every item as read", () => {
    const page = { items: [note("a", false), note("b", true)] } as unknown as NotificationGetAll;

    expect(patchMarkAllList(page)?.items.every((item) => item.isRead)).toBe(true);
  });
});

describe("patchMarkAllFeed", () => {
  it("marks every item in every page as read", () => {
    const feed = {
      pageParams: [],
      pages: [{ items: [note("a", false)] }, { items: [note("b", false)] }],
    } as unknown as FeedData;

    expect(
      patchMarkAllFeed(feed)?.pages.every((page) => page.items.every((item) => item.isRead)),
    ).toBe(true);
  });

  it("passes through a missing feed", () => {
    expect(patchMarkAllFeed(undefined)).toBeUndefined();
  });
});
