import { trpc, type MarkAllInput } from "@/shared/api/trpc";

import type { NotificationsParsersState } from "@/entities/notifications/model/notifications-parsers";

const mapFiltersToInput = (filters?: NotificationsParsersState): MarkAllInput => {
  if (filters == null) return {};

  return {
    repoName: filters.repo ?? undefined,
    repoOwner: filters.owner ?? undefined,
    search: filters.search || undefined,
    type: filters.type ?? undefined,
  };
};

export function useNotificationActions() {
  const utils = trpc.useUtils();

  const invalidateAll = async () => {
    await Promise.all([
      utils.notification.getStats.invalidate(),
      utils.notification.getAll.invalidate(),
    ]);
  };
  const markAllAsRead = trpc.notification.markAllAsRead.useMutation({
    onSuccess: invalidateAll,
  });

  const deleteRead = trpc.notification.deleteRead.useMutation({
    onSuccess: invalidateAll,
  });

  const deleteOne = trpc.notification.deleteOne.useMutation({
    onSuccess: invalidateAll,
  });

  const markAs = trpc.notification.markAs.useMutation({
    onSuccess: invalidateAll,
  });

  return {
    deleteOne: {
      isPending: deleteOne.isPending,
      mutate: (id: string, options?: Parameters<typeof deleteOne.mutate>[1]) =>
        deleteOne.mutate({ id }, options),
    },
    deleteRead: {
      isPending: deleteRead.isPending,
      mutate: (
        filters?: NotificationsParsersState,
        options?: Parameters<typeof deleteRead.mutate>[1]
      ) => deleteRead.mutate(mapFiltersToInput(filters), options),
    },
    invalidateAll,
    markAllAsRead: {
      isPending: markAllAsRead.isPending,
      mutate: (
        filters?: NotificationsParsersState,
        options?: Parameters<typeof markAllAsRead.mutate>[1]
      ) => markAllAsRead.mutate(mapFiltersToInput(filters), options),
    },
    markAs: {
      isPending: markAs.isPending,
      mutate: (id: string, isRead: boolean, options?: Parameters<typeof markAs.mutate>[1]) =>
        markAs.mutate({ id, isRead }, options),
    },
  };
}
