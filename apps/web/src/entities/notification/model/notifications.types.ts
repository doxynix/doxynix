import type { InfiniteData } from "@tanstack/react-query";

import type { RouterInput, RouterOutput } from "@/shared/api/trpc";

export type UiNotification = RouterOutput["notification"]["getAll"]["items"][number];

export type NotificationType = UiNotification["type"];

export type NotificationGetAll = RouterOutput["notification"]["getAll"];

export type NotificationMeta = NotificationGetAll["meta"];

export type MarkAllInput = RouterInput["notification"]["markAllAsRead"];

export type FeedPage = RouterOutput["notification"]["getFeed"];

export type Stats = RouterOutput["notification"]["getStats"];

export type FeedData = InfiniteData<FeedPage>;
