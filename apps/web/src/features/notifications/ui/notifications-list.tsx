"use client";

import { BellOff, Eye, EyeOff, SearchX, Trash2 } from "lucide-react";

import { EmptyState } from "@/shared/ui/kit/empty-state";

import type {
  NotificationMeta,
  UiNotification,
} from "@/entities/notifications/model/notifications.types";
import { NotificationCard } from "@/entities/notifications/ui/notification-card";

import { useNotificationActions } from "../model/use-notification-actions";
import { NotificationActionButton } from "./notification-action-button";

type Props = { meta?: NotificationMeta; notifications: UiNotification[] };

export function NotificationsList({ meta, notifications }: Readonly<Props>) {
  const { deleteOne, markAs } = useNotificationActions();
  const isPending = markAs.isPending || deleteOne.isPending;

  if (meta == null || meta.totalCount === 0) {
    return (
      <EmptyState
        description={undefined}
        icon={BellOff}
        title="No notifications found"
      />
    );
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
        <NotificationCard
          actions={
            <>
              <NotificationActionButton
                disabled={isPending}
                icon={n.isRead ? EyeOff : Eye}
                isPending={markAs.isPending}
                onClick={() => markAs.mutate(n.id, !n.isRead)}
                tooltip={n.isRead ? "Mark as unread" : "Mark as read"}
              />
              <NotificationActionButton
                className="hover:text-destructive"
                disabled={isPending}
                icon={Trash2}
                isPending={deleteOne.isPending}
                onClick={() => deleteOne.mutate(n.id)}
                tooltip="Delete notification"
              />
            </>
          }
          key={n.id}
          notification={n}
        />
      ))}
    </div>
  );
}
