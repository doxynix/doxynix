"use client";

import { useQueryStates } from "nuqs";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
import { clampIntegerParam } from "@/shared/lib/utils";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { notificationsParsers } from "@/entities/notifications";

import { NotificationCardSkeleton } from "./notification-card-skeleton";
import { NotificationsHeader } from "./notifications-header";
import { NotificationsList } from "./notifications-list";

export function NotificationsListContainer() {
  const [params] = useQueryStates(notificationsParsers);
  const [debouncedSearch] = useDebounce(params.search, 500);
  const safePage = clampIntegerParam(params.page, { fallback: 1, max: 1_000_000, min: 1 });
  const safeLimit = clampIntegerParam(params.limit, { fallback: 20, max: 100, min: 1 });

  const {
    data,
    isFetching,
    isLoading: isListLoading,
  } = trpc.notification.getAll.useQuery(
    {
      cursor: safePage,
      isRead: params.isRead ?? undefined,
      limit: safeLimit,
      repoName: params.repo ?? undefined,
      repoOwner: params.owner ?? undefined,
      search: debouncedSearch || undefined,
      type: params.type ?? undefined,
    },
    { placeholderData: (previousData) => previousData }
  );

  const { data: stats } = trpc.notification.getStats.useQuery();

  return (
    <>
      <NotificationsHeader stats={stats} />

      {isListLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: safeLimit }).map((_, i) => (
            <NotificationCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1">
            <NotificationsList meta={data.meta} notifications={data.items} />
          </div>
          <AppPagination isLoading={isFetching} meta={data.meta} className="mt-4" />
        </>
      )}
    </>
  );
}
