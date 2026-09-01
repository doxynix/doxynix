"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/core/dropdown-menu";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { notificationTypeConfig } from "@/features/notifications/model/notification-type-config";
import { useNotificationActions } from "@/features/notifications/model/use-notification-actions";

export function NotificationsNav() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  const { markAllAsRead, markAs } = useNotificationActions();

  const { data, isLoading } = trpc.notification.getAll.useQuery({ limit: 5 });
  const notifications = data?.items ?? [];

  const { data: unreadData } = trpc.notification.getStats.useQuery();
  const unreadCount = unreadData?.unread ?? 0;

  return (
    <DropdownMenu>
      <AppTooltip content={t("notifications_title")}>
        <DropdownMenuTrigger asChild>
          <AppButton
            aria-label={t("notifications_title")}
            className="relative cursor-pointer text-muted-foreground"
            size="icon"
            variant="ghost"
          >
            <Bell />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-foreground" />
            )}
          </AppButton>
        </DropdownMenuTrigger>
      </AppTooltip>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between p-2">
          <h2>{t("notifications_title")}</h2>
          <AppButton
            className="cursor-pointer text-xs"
            disabled={markAllAsRead.isPending || unreadCount === 0}
            onClick={() => markAllAsRead.mutate()}
            variant="link"
          >
            {t("notifications_mark_read")}
          </AppButton>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          {notifications.length === 0 && !isLoading ? (
            <p className="p-4 text-center text-muted-foreground text-sm">No notifications</p>
          ) : (
            notifications.map((note) => {
              const href =
                note.repo != null ? `/dashboard/repo/${note.repo.owner}/${note.repo.name}` : null;
              const { color, icon: Icon } = notificationTypeConfig[note.type];

              const innerContent = (
                <>
                  <Icon className={cn("size-5", color)} />
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <p
                        className={cn(
                          "mb-1 font-bold",

                          note.isRead && "text-muted-foreground",
                        )}
                      >
                        {note.title}
                      </p>
                      <p className="max-w-57.5 truncate text-muted-foreground text-xs">
                        {note.body}
                      </p>
                      <TimeAgo className="w-fit text-xs" date={note.createdAt} locale={locale} />
                    </div>
                    {!note.isRead && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-foreground" />
                    )}
                  </div>
                </>
              );

              const commonClasses = "flex items-center gap-1 p-3 w-full";

              return (
                <DropdownMenuItem
                  asChild
                  className={cn(!note.isRead && "bg-surface-selected")}
                  key={note.id}
                  onSelect={() => {
                    if (!note.isRead) {
                      markAs.mutate(note.id, true);
                    }
                  }}
                >
                  {href == null ? (
                    <div className={cn(commonClasses, "cursor-default")}>{innerContent}</div>
                  ) : (
                    <Link className={cn(commonClasses, "cursor-pointer")} href={href}>
                      {innerContent}
                    </Link>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="group flex cursor-pointer items-center justify-center">
          <Link
            className="flex w-full items-center justify-center group-hover:underline"
            href="/dashboard/notifications"
          >
            {t("notifications_show_all")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
