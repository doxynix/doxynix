import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

import { mapFiltersToInput } from "@/entities/notification/model/notification-filters.utils";
import type {
  FeedData,
  NotificationGetAll,
  Stats,
} from "@/entities/notification/model/notifications.types";
import type { NotificationsParsersState } from "@/entities/notification/model/notifications-parsers";

import {
  type NotificationCacheSnapshot,
  patchDeleteFeed,
  patchDeleteList,
  patchDeleteStats,
  patchMarkAsFeed,
  patchMarkAsList,
  patchMarkAsStats,
} from "./notification-cache";

type MarkAsVariables = { id: string; isRead: boolean };

export function useNotificationActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.notification.getStats.pathFilter()),
      queryClient.invalidateQueries(trpc.notification.getAll.pathFilter()),
      queryClient.invalidateQueries(trpc.notification.getFeed.pathFilter()),
    ]);
  };

  const listKey = trpc.notification.getAll.queryKey();
  const feedKey = trpc.notification.getFeed.infiniteQueryKey();
  const statsKey = trpc.notification.getStats.queryKey();

  const takeSnapshot = async (): Promise<NotificationCacheSnapshot> => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: statsKey }),
      queryClient.cancelQueries({ queryKey: listKey }),
      queryClient.cancelQueries({ queryKey: feedKey }),
    ]);

    return {
      feed: queryClient.getQueriesData({ queryKey: feedKey }),
      list: queryClient.getQueriesData({ queryKey: listKey }),
      stats: queryClient.getQueryData(statsKey),
    };
  };

  const rollback = (snapshot: NotificationCacheSnapshot) => {
    for (const [key, data] of snapshot.list) {
      queryClient.setQueryData(key, data);
    }
    for (const [key, data] of snapshot.feed) {
      queryClient.setQueryData(key, data);
    }
    queryClient.setQueryData(statsKey, snapshot.stats);
  };

  const deleteOne = useMutation(
    trpc.notification.deleteOne.mutationOptions<NotificationCacheSnapshot>({
      onError: (_error, _variables, snapshot) => {
        if (snapshot != null) {
          rollback(snapshot);
        }
      },
      onMutate: async (variables) => {
        const snapshot = await takeSnapshot();

        const item = snapshot.list
          .map(([, page]) => page?.items.find((entry) => entry.id === variables.id))
          .find((found) => found != null);

        queryClient.setQueriesData<NotificationGetAll>({ queryKey: listKey }, (page) =>
          patchDeleteList(page, variables.id),
        );
        queryClient.setQueriesData<FeedData>({ queryKey: feedKey }, (data) =>
          patchDeleteFeed(data, variables.id),
        );
        queryClient.setQueryData<Stats>(statsKey, (stats) => patchDeleteStats(stats, item));

        return snapshot;
      },
      onSuccess: invalidateAll,
    }),
  );

  const deleteRead = useMutation(
    trpc.notification.deleteRead.mutationOptions({
      onSuccess: invalidateAll,
    }),
  );

  const markAs = useMutation(
    trpc.notification.markAs.mutationOptions<NotificationCacheSnapshot>({
      onError: (_error, _variables, snapshot) => {
        if (snapshot != null) {
          rollback(snapshot);
        }
      },
      onMutate: async (variables) => {
        const snapshot = await takeSnapshot();
        const item = snapshot.list
          .map(([, page]) => page?.items.find((entry) => entry.id === variables.id))
          .find((found) => found != null);

        queryClient.setQueriesData<NotificationGetAll>({ queryKey: listKey }, (page) =>
          patchMarkAsList(page, variables.id, variables.isRead),
        );
        queryClient.setQueriesData<FeedData>({ queryKey: feedKey }, (data) =>
          patchMarkAsFeed(data, variables.id, variables.isRead),
        );
        queryClient.setQueryData<Stats>(statsKey, (stats) =>
          patchMarkAsStats(stats, item?.isRead ?? true, variables.isRead),
        );

        return snapshot;
      },
      onSuccess: invalidateAll,
    }),
  );

  const markAllAsRead = useMutation(
    trpc.notification.markAllAsRead.mutationOptions({
      onSuccess: invalidateAll,
    }),
  );

  const pendingMarkAsIds = useMutationState({
    filters: { mutationKey: trpc.notification.markAs.mutationKey(), status: "pending" },
    select: (mutation) => (mutation.state.variables as MarkAsVariables).id,
  });

  const pendingDeleteIds = useMutationState({
    filters: { mutationKey: trpc.notification.deleteOne.mutationKey(), status: "pending" },
    select: (mutation) => (mutation.state.variables as { id: string }).id,
  });

  return {
    deleteOne: {
      isPending: deleteOne.isPending,
      mutate: (id: string, options?: Parameters<typeof deleteOne.mutate>[1]) =>
        deleteOne.mutate({ id }, options),
      pendingIds: pendingDeleteIds,
    },
    deleteRead: {
      isPending: deleteRead.isPending,
      mutate: (
        filters?: NotificationsParsersState,
        options?: Parameters<typeof deleteRead.mutate>[1],
      ) => deleteRead.mutate(mapFiltersToInput(filters), options),
    },
    invalidateAll,
    markAllAsRead: {
      isPending: markAllAsRead.isPending,
      mutate: (
        filters?: NotificationsParsersState,
        options?: Parameters<typeof markAllAsRead.mutate>[1],
      ) => markAllAsRead.mutate(mapFiltersToInput(filters), options),
    },
    markAs: {
      isPending: markAs.isPending,
      mutate: (id: string, isRead: boolean, options?: Parameters<typeof markAs.mutate>[1]) =>
        markAs.mutate({ id, isRead }, options),
      pendingIds: pendingMarkAsIds,
    },
  };
}
