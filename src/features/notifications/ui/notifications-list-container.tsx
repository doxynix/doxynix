"use client";

import { useQueryStates } from "nuqs";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { notificationsParsers } from "@/entities/notifications";

import { NotificationCardSkeleton } from "./notification-card-skeleton";
import { NotificationsHeader } from "./notifications-header";
import { NotificationsList } from "./notifications-list";

export function NotificationsListContainer() {
  const [params] = useQueryStates(notificationsParsers);
  const [debouncedSearch] = useDebounce(params.search, 500);

  const {
    data,
    isFetching,
    isLoading: isListLoading,
  } = trpc.notification.getAll.useQuery(
    {
      cursor: params.page,
      isRead: params.isRead ?? undefined,
      limit: params.limit,
      repoName: params.repo ?? undefined,
      repoOwner: params.owner ?? undefined,
      search: debouncedSearch || undefined,
      type: params.type ?? undefined,
    },
    { placeholderData: (previousData) => previousData }
  );

  const { data: stats } = trpc.notification.getStats.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <NotificationsHeader stats={stats} />

      {isListLoading || !data ? (
        <NotificationCardSkeleton />
      ) : (
        <>
          <div className={isFetching ? "opacity-50" : ""}>
            <NotificationsList notifications={data.items} />
          </div>
          <AppPagination isLoading={isFetching} meta={data.meta} className="mt-auto" />
        </>
      )}
    </div>
  );
}
