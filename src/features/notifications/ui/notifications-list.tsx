"use client";

import { type UiNotification } from "@/shared/api/trpc";

import { NotificationCard } from "./notification-card";

type Props = { notifications: UiNotification[] };

export function NotificationsList({ notifications }: Readonly<Props>) {
  if (notifications.length === 0) {
    return <p className="text-muted-foreground py-10 text-center">No notifications found</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {notifications.map((n) => (
        <NotificationCard key={n.id} notification={n} />
      ))}
    </div>
  );
}
