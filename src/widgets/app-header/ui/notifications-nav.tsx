"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/core/dropdown-menu";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { TimeAgo } from "@/shared/ui/kit/time-ago";
import { Link } from "@/i18n/routing";

import { notificationTypeConfig, useNotificationActions } from "@/features/notifications";

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
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("notifications_title")}
            className="text-muted-foreground relative cursor-pointer"
          >
            <Bell />
            {unreadCount > 0 && (
              <span className="bg-foreground absolute top-2 right-2 size-2 rounded-full" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </AppTooltip>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between p-2">
          <h2>{t("notifications_title")}</h2>
          <Button
            disabled={markAllAsRead.isPending || unreadCount === 0}
            variant="link"
            onClick={() => markAllAsRead.mutate()}
            className="cursor-pointer text-xs"
          >
            {t("notifications_mark_read")}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          {notifications.length === 0 && !isLoading ? (
            <p className="text-muted-foreground p-4 text-center text-sm">No notifications</p>
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
                          note.isRead === true && "text-muted-foreground"
                        )}
                      >
                        {note.title}
                      </p>
                      <p className="text-muted-foreground max-w-57.5 truncate text-xs">
                        {note.body}
                      </p>
                      <TimeAgo date={note.createdAt} locale={locale} />
                    </div>
                    {note.isRead === false && (
                      <span className="bg-foreground mt-1 size-2 shrink-0 rounded-full" />
                    )}
                  </div>
                </>
              );

              const commonClasses = "flex items-center gap-1 p-3 w-full";

              return (
                <DropdownMenuItem
                  key={note.id}
                  asChild
                  onSelect={() => {
                    if (note.isRead === false) markAs.mutate(note.id, true);
                  }}
                  className={cn(note.isRead === false && "bg-surface-selected")}
                >
                  {href == null ? (
                    <div className={cn(commonClasses, "cursor-default")}>{innerContent}</div>
                  ) : (
                    <Link href={href} className={cn(commonClasses, "cursor-pointer")}>
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
            href="/dashboard/notifications"
            className="flex w-full items-center justify-center group-hover:underline"
          >
            {t("notifications_show_all")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
