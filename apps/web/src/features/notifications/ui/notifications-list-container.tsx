"use client";
import { MAX_PAGE, MAX_PAGE_SIZE } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { AppPagination } from "@/shared/ui/kit/app-pagination";
import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import {
  NOTIFICATIONS_DEFAULT_LIMIT,
  notificationsParsers,
} from "@/entities/notification/model/notifications-parsers";
import { NotificationCardSkeleton } from "@/entities/notification/ui/notification-card-skeleton";

import { useNotificationStats } from "../model/use-notification-stats";
import { NotificationsHeader } from "./notifications-header";
import { NotificationsList } from "./notifications-list";

export function NotificationsListContainer() {
  const trpc = useTRPC();
  const [params] = useQueryStates(notificationsParsers);
  const debouncedSearch = useDebounce(params.search, 500);
  const safePage = clampIntegerParam(params.page, { fallback: 1, max: MAX_PAGE, min: 1 });
  const safeLimit = clampIntegerParam(params.limit, {
    fallback: NOTIFICATIONS_DEFAULT_LIMIT,
    max: MAX_PAGE_SIZE,
    min: 1,
  });

  const {
    data,
    isFetching,
    isLoading: isListLoading,
  } = useQuery(
    trpc.notification.getAll.queryOptions(
      {
        from: params.from ?? undefined,
        isRead: params.isRead ?? undefined,
        limit: safeLimit,
        page: safePage,
        repoName: params.repo ?? undefined,
        repoOwner: params.owner ?? undefined,
        search: debouncedSearch || undefined,
        to: params.to ?? undefined,
        type: params.type ?? undefined,
      },
      { placeholderData: (previousData) => previousData },
    ),
  );

  const { data: stats } = useNotificationStats();

  return (
    <>
      <NotificationsHeader stats={stats} />

      {isListLoading || data == null ? (
        <SkeletonList
          className="flex flex-col gap-3"
          count={safeLimit}
          renderItem={() => <NotificationCardSkeleton />}
        />
      ) : (
        <>
          <div className="flex-1">
            <NotificationsList
              meta={data.meta}
              notifications={data.items}
            />
          </div>
          <AppPagination
            className="mt-4"
            isLoading={isFetching}
            meta={data.meta}
          />
        </>
      )}
    </>
  );
}
