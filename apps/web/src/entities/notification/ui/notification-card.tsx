"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { notificationTypeConfig } from "../model/notification-type-config";
import type { NotificationType, UiNotification } from "../model/notifications.types";

const TILE_CLASS: Record<NotificationType, string> = {
  ERROR: "bg-destructive/10",
  INFO: "bg-muted",
  SUCCESS: "bg-success/10",
  WARNING: "bg-warning/10",
};

type Props = {
  actions?: ReactNode;
  notification: UiNotification;
};

export function NotificationCard({ actions, notification }: Readonly<Props>) {
  const { color, icon: Icon } = notificationTypeConfig[notification.type];
  const locale = useLocale();
  const href =
    notification.repo != null
      ? `/dashboard/repo/${notification.repo.owner}/${notification.repo.name}`
      : null;
  const repoLabel =
    notification.repo != null ? `${notification.repo.owner}/${notification.repo.name}` : null;

  return (
    <div
      className={cn(
        "group/notification relative flex min-w-0 items-start gap-3 px-4 py-3.5 transition-standard",
        notification.isRead ? "hover:bg-surface-hover" : "bg-surface-selected",
      )}
    >
      {href != null && (
        <Link
          aria-label={notification.title}
          className="absolute inset-0"
          href={href}
        />
      )}

      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          TILE_CLASS[notification.type],
        )}
      >
        <Icon className={cn("size-4", color)} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "truncate font-semibold text-sm",
              notification.isRead ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {notification.title}
          </span>
          {!notification.isRead && (
            <span
              aria-hidden={true}
              className="size-1.5 shrink-0 rounded-full bg-foreground"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-2xs text-muted-foreground tabular-nums">
          <span>{notification.type}</span>
          {repoLabel != null && (
            <>
              <span
                aria-hidden={true}
                className="text-border-strong"
              >
                ·
              </span>
              <span className="max-w-[45%] truncate">{repoLabel}</span>
            </>
          )}
          <span
            aria-hidden={true}
            className="text-border-strong"
          >
            ·
          </span>
          <TimeAgo
            date={notification.createdAt}
            locale={locale}
          />
        </div>

        {notification.body !== "" && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>
        )}
      </div>

      <div className="z-10 flex shrink-0 items-center gap-0.5 [&_button:focus-visible]:opacity-100">
        {actions}
      </div>
    </div>
  );
}
