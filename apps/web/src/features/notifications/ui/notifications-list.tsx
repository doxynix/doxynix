"use client";

import { BellOff, Eye, EyeOff, SearchX, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card } from "@/shared/ui/core/card";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import type {
  NotificationMeta,
  UiNotification,
} from "@/entities/notification/model/notifications.types";
import { NotificationCard } from "@/entities/notification/ui/notification-card";

import { useNotificationActions } from "../model/use-notification-actions";
import { NotificationActionButton } from "./notification-action-button";

type Props = { meta?: NotificationMeta; notifications: UiNotification[] };

export function NotificationsList({ meta, notifications }: Readonly<Props>) {
  const { deleteOne, markAs } = useNotificationActions();
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");

  if (meta == null || meta.totalCount === 0) {
    return (
      <EmptyState
        description={undefined}
        icon={BellOff}
        title={t("no_notifications")}
      />
    );
  }

  if (meta.filteredCount === 0) {
    return (
      <EmptyState
        description={
          meta.searchQuery !== "" && meta.searchQuery != null ? (
            <span>
              {tCommon("nothing_found_for")}{" "}
              <span className="italic">{`"${meta.searchQuery}"`}</span>
            </span>
          ) : (
            t("try_changing_filters")
          )
        }
        icon={SearchX}
        title={t("nothing_found")}
      />
    );
  }

  return (
    <Card className="gap-0 divide-y divide-border overflow-hidden p-0">
      {notifications.map((n) => {
        const isMarking = markAs.pendingIds.includes(n.id);
        const isDeleting = deleteOne.pendingIds.includes(n.id);
        const isCardPending = isMarking || isDeleting;

        return (
          <NotificationCard
            actions={
              <>
                <NotificationActionButton
                  disabled={isCardPending}
                  icon={n.isRead ? EyeOff : Eye}
                  isPending={isMarking}
                  onClick={() => markAs.mutate(n.id, !n.isRead)}
                  tooltip={n.isRead ? t("mark_as_unread") : t("mark_as_read")}
                />
                <NotificationActionButton
                  className="hover:text-destructive"
                  disabled={isCardPending}
                  icon={Trash2}
                  isPending={isDeleting}
                  onClick={() => deleteOne.mutate(n.id)}
                  tooltip={t("delete_notification")}
                />
              </>
            }
            key={n.id}
            notification={n}
          />
        );
      })}
    </Card>
  );
}
