import type { RouterInput, RouterOutput } from "@/shared/api/trpc";

export type UiNotification = RouterOutput["notification"]["getAll"]["items"][number];

export type NotificationType = UiNotification["type"];

export type NotificationGetAll = RouterOutput["notification"]["getAll"];

export type NotificationMeta = NotificationGetAll["meta"];

export type MarkAllInput = RouterInput["notification"]["markAllAsRead"];
