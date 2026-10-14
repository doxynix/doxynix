"use client";

import { useEffect, useRef, useState } from "react";
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
import { Spinner } from "@/shared/ui/core/spinner";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { notificationTypeConfig } from "@/entities/notification/model/notification-type-config";

import { useNotificationActions } from "@/features/notifications/model/use-notification-actions";

const PAGE_SIZE = 10;

export function NotificationsNav() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  const { markAllAsRead, markAs } = useNotificationActions();

  const [open, setOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pendingReadIds, setPendingReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [allReadPending, setAllReadPending] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.notification.getFeed.useInfiniteQuery(
      { limit: PAGE_SIZE },
      {
        enabled: open,
        getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
        initialCursor: undefined,
      },
    );

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  const { data: unreadData } = trpc.notification.getStats.useQuery();
  const unreadCount = allReadPending ? 0 : (unreadData?.unread ?? 0);

  function clearPendingRead(id: string) {
    setPendingReadIds((previous) => {
      if (!previous.has(id)) {
        return previous;
      }

      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  function handleSelectRead(id: string) {
    setPendingReadIds((previous) => new Set(previous).add(id));
    markAs.mutate(id, true, { onSettled: () => clearPendingRead(id) });
  }

  function handleMarkAllAsRead() {
    setAllReadPending(true);
    markAllAsRead.mutate(undefined, { onSettled: () => setAllReadPending(false) });
  }

  useEffect(() => {
    const target = sentinelRef.current;
    if (!hasNextPage || isFetchingNextPage || target == null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <DropdownMenu
      onOpenChange={setOpen}
      open={open}
    >
      <AppTooltip content={t("notifications_title")}>
        <DropdownMenuTrigger asChild>
          <AppButton
            aria-label={t("notifications_title")}
            className="relative text-muted-foreground"
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
            className="text-xs"
            disabled={markAllAsRead.isPending || unreadCount === 0}
            onClick={handleMarkAllAsRead}
            variant="link"
          >
            {t("notifications_mark_read")}
          </AppButton>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          {notifications.length === 0 && !isLoading ? (
            <p className="p-4 text-center text-muted-foreground text-sm">
              {t("notifications_empty")}
            </p>
          ) : (
            notifications.map((note) => {
              const isRead = note.isRead || allReadPending || pendingReadIds.has(note.id);
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

                          isRead && "text-muted-foreground",
                        )}
                      >
                        {note.title}
                      </p>
                      <p className="max-w-57.5 truncate text-muted-foreground text-xs">
                        {note.body}
                      </p>
                      <TimeAgo
                        className="w-fit text-xs"
                        date={note.createdAt}
                        locale={locale}
                      />
                    </div>
                    {!isRead && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-foreground" />
                    )}
                  </div>
                </>
              );

              const commonClasses = "flex items-center gap-1 p-3 w-full";

              return (
                <DropdownMenuItem
                  asChild
                  className={cn(!isRead && "bg-surface-selected")}
                  key={note.id}
                  onSelect={() => {
                    if (!note.isRead) {
                      handleSelectRead(note.id);
                    }
                  }}
                >
                  {href == null ? (
                    <div className={cn(commonClasses, "cursor-default")}>{innerContent}</div>
                  ) : (
                    <Link
                      className={cn(commonClasses, "cursor-pointer")}
                      href={href}
                    >
                      {innerContent}
                    </Link>
                  )}
                </DropdownMenuItem>
              );
            })
          )}

          {hasNextPage && (
            <div
              className="flex items-center justify-center py-2"
              ref={sentinelRef}
            >
              {isFetchingNextPage && <Spinner />}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="group flex cursor-pointer items-center justify-center"
        >
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
