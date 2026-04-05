"use client";

import { BellOff, SearchX } from "lucide-react";

import { type NotificationMeta, type UiNotification } from "@/shared/api/trpc";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { NotificationCard } from "./notification-card";

type Props = { meta?: NotificationMeta; notifications: UiNotification[] };

export function NotificationsList({ meta, notifications }: Readonly<Props>) {
  if (!meta || meta.totalCount === 0) {
    return <EmptyState description={undefined} icon={BellOff} title="No notifications found" />;
  }

  if (meta.filteredCount === 0) {
    return (
      <EmptyState
        description={
          meta.searchQuery !== "" && meta.searchQuery != null ? (
            <span>
              Nothing found for <span className="italic">{`"${meta.searchQuery}"`}</span>
            </span>
          ) : (
            "Try changing filter parameters"
          )
        }
        icon={SearchX}
        title="Nothing found"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notifications.map((n) => (
        <NotificationCard key={n.id} notification={n} />
      ))}
    </div>
  );
}
