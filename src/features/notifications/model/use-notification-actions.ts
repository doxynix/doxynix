import { trpc } from "@/shared/api/trpc";

export function useNotificationActions() {
  const utils = trpc.useUtils();

  const invalidateAll = () => {
    void utils.notification.getUnreadCount.invalidate();
    void utils.notification.getAll.invalidate();
  };

  const markRead = trpc.notification.markAsRead.useMutation({
    onSuccess: invalidateAll,
  });

  const markAllRead = trpc.notification.markAllAsRead.useMutation({
    onSuccess: invalidateAll,
  });

  return {
    invalidateAll,
    markAllRead: {
      isPending: markAllRead.isPending,
      mutate: () => markAllRead.mutate(),
    },
    markRead: {
      isPending: markRead.isPending,
      mutate: (id: string) => markRead.mutate({ id }),
    },
  };
}
