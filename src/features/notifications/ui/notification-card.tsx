"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";

import { type UiNotification } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardTitle } from "@/shared/ui/core/card";
import { TimeAgo } from "@/shared/ui/kit/time-ago";
import { Link } from "@/i18n/routing";

import { notificationTypeConfig } from "../model/notification-type-config";
import { useNotificationActions } from "../model/use-notification-actions";
import { NotificationActionButton } from "./notification-action-button";

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
        "group hover:border-border-strong relative border-l-4",
        notification.isRead === false && "bg-surface-selected",
        border
      )}
    >
      {href != null && (
        <Link href={href} aria-label={notification.title} className="absolute inset-0" />
      )}

      <CardContent className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-4">
            <Icon className={cn("size-5", color)} />
            <span
              className={cn(
                "bg-foreground size-2 shrink-0 rounded-full opacity-0",
                notification.isRead === false && "opacity-100"
              )}
            />
            <div className="flex flex-col gap-2">
              <CardTitle
                className={cn(
                  "group-hover:text-foreground",
                  notification.isRead === true && "text-muted-foreground"
                )}
              >
                {notification.title}
              </CardTitle>
              <CardDescription>{notification.body}</CardDescription>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-4">
          <div className="flex items-center gap-2">
            <NotificationActionButton
              disabled={isPending}
              icon={notification.isRead === true ? EyeOff : Eye}
              isPending={markAs.isPending}
              tooltip={notification.isRead === true ? "Mark as unread" : "Mark as read"}
              onClick={() => markAs.mutate(notification.id, notification.isRead === false)}
            />
            <NotificationActionButton
              disabled={isPending}
              icon={Trash2}
              isPending={deleteOne.isPending}
              tooltip="Delete notification"
              onClick={() => deleteOne.mutate(notification.id)}
              className="hover:text-destructive"
            />
          </div>
          <TimeAgo date={notification.createdAt} locale={locale} />
        </div>
      </CardContent>
    </Card>
  );
}
