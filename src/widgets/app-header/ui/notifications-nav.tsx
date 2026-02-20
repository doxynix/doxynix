"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
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
import { useNotificationActions } from "@/features/notifications";

import { Link } from "@/i18n/routing";

export function NotificationsNav() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  const { markRead, markAllRead } = useNotificationActions();

  const { data: notifications = [] } = trpc.notification.getAll.useQuery({ count: 5 });
  const { data: unreadData } = trpc.notification.getUnreadCount.useQuery();
  const unreadCount = unreadData?.count ?? 0;

  return (
    <DropdownMenu>
      <AppTooltip content={t("notifications_title")}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground relative cursor-pointer"
          >
            <Bell />
            {unreadCount > 0 && (
              <span className="bg-foreground absolute top-2 right-2 h-2 w-2 rounded-full" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </AppTooltip>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between p-2">
          <h2>{t("notifications_title")}</h2>
          <Button
            variant="link"
            className="cursor-pointer text-xs"
            disabled={markAllRead.isPending || unreadCount === 0}
            onClick={() => markAllRead.mutate()}
          >
            {t("notifications_mark_read")}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          {notifications.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">Нет уведомлений</div>
          ) : (
            notifications.map((note) => (
              <DropdownMenuItem
                key={note.id}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 p-3",
                  !note.isRead && "bg-accent/50"
                )}
                onClick={() => {
                  if (!note.isRead) markRead.mutate(note.id);
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <p className="mb-1 font-bold">{note.title}</p>
                    <p className="text-muted-foreground text-xs">{note.body}</p>
                    <TimeAgo date={note.createdAt} locale={locale} />
                  </div>
                  {!note.isRead && (
                    <span className="bg-muted-foreground mt-1 h-2 w-2 shrink-0 rounded-full" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
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
