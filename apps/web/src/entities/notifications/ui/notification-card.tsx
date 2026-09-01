"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { Card, CardContent, CardDescription, CardTitle } from "@/shared/ui/core/card";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { notificationTypeConfig } from "@/features/notifications/model/notification-type-config";
import { useNotificationActions } from "@/features/notifications/model/use-notification-actions";
import { NotificationActionButton } from "@/features/notifications/ui/notification-action-button";

import type { UiNotification } from "../model/notifications.types";

type Props = { notification: UiNotification };

export function NotificationCard({ notification }: Readonly<Props>) {
  const { border, color, icon: Icon } = notificationTypeConfig[notification.type];
  const locale = useLocale();
  const href =
    notification.repo != null
      ? `/dashboard/repo/${notification.repo.owner}/${notification.repo.name}`
      : null;

  const { deleteOne, markAs } = useNotificationActions();
  const isPending = markAs.isPending || deleteOne.isPending;

  return (
    <Card
      className={cn(
        "group relative border-l-4 p-4 hover:border-border-strong",
        !notification.isRead && "bg-surface-selected",
        border,
      )}
    >
      {href != null && (
        <Link aria-label={notification.title} className="absolute inset-0" href={href} />
      )}

      <CardContent className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-4">
            <Icon className={cn("size-5", color)} />
            <span
              className={cn(
                "size-2 shrink-0 rounded-full bg-foreground opacity-0",
                !notification.isRead && "opacity-100",
              )}
            />
            <div className="flex flex-col gap-2">
              <CardTitle
                className={cn(
                  "group-hover:text-foreground",

                  notification.isRead && "text-muted-foreground",
                )}
              >
                {notification.title}
              </CardTitle>
              <CardDescription>{notification.body}</CardDescription>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <NotificationActionButton
              disabled={isPending}
              icon={notification.isRead ? EyeOff : Eye}
              isPending={markAs.isPending}
              onClick={() => markAs.mutate(notification.id, !notification.isRead)}
              tooltip={notification.isRead ? "Mark as unread" : "Mark as read"}
            />
            <NotificationActionButton
              className="hover:text-destructive"
              disabled={isPending}
              icon={Trash2}
              isPending={deleteOne.isPending}
              onClick={() => deleteOne.mutate(notification.id)}
              tooltip="Delete notification"
            />
          </div>
          <TimeAgo className="z-10 w-fit text-xs" date={notification.createdAt} locale={locale} />
        </div>
      </CardContent>
    </Card>
  );
}
