import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import type {
  FeedData,
  FeedPage,
  NotificationGetAll,
  Stats,
  UiNotification,
} from "@/entities/notification/model/notifications.types";

export type NotificationCacheSnapshot = {
  feed: [key: QueryKey, data: FeedData | undefined][];
  list: [key: QueryKey, data: NotificationGetAll | undefined][];
  stats: Stats | undefined;
};

function patchPages<T extends { items: UiNotification[] }>(
  page: T,
  id: string,
  apply: (item: UiNotification) => UiNotification,
): T {
  return { ...page, items: page.items.map((item) => (item.id === id ? apply(item) : item)) };
}

export function patchMarkAsFeed(
  data: InfiniteData<FeedPage> | undefined,
  id: string,
  isRead: boolean,
) {
  return data == null
    ? data
    : {
        ...data,
        pages: data.pages.map((page) => patchPages(page, id, (item) => ({ ...item, isRead }))),
      };
}

export function patchDeleteFeed(data: InfiniteData<FeedPage> | undefined, id: string) {
  return data == null
    ? data
    : {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== id),
        })),
      };
}

export function patchMarkAsList(page: NotificationGetAll | undefined, id: string, isRead: boolean) {
  return page == null ? page : patchPages(page, id, (item) => ({ ...item, isRead }));
}

export function patchDeleteList(page: NotificationGetAll | undefined, id: string) {
  return page == null ? page : { ...page, items: page.items.filter((item) => item.id !== id) };
}

export function patchMarkAsStats(stats: Stats | undefined, wasRead: boolean, isRead: boolean) {
  if (stats == null || wasRead === isRead) {
    return stats;
  }

  return { ...stats, unread: Math.max(0, stats.unread + (isRead ? -1 : 1)) };
}

export function patchDeleteStats(stats: Stats | undefined, item: UiNotification | undefined) {
  if (stats == null || item == null) {
    return stats;
  }

  return {
    ...stats,
    read: Math.max(0, stats.read - (item.isRead ? 1 : 0)),
    total: Math.max(0, stats.total - 1),
    unread: Math.max(0, stats.unread - (item.isRead ? 0 : 1)),
  };
}
