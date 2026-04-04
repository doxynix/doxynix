"use client";

import { BellOff } from "lucide-react";

import { type UiNotification } from "@/shared/api/trpc";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { NotificationCard } from "./notification-card";

type Props = { notifications: UiNotification[] };

export function NotificationsList({ notifications }: Readonly<Props>) {
  if (notifications.length === 0) {
    return <EmptyState description={undefined} icon={BellOff} title="No notifications found" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {notifications.map((n) => (
        <NotificationCard key={n.id} notification={n} />
      ))}
    </div>
  );
}
