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
    markRead: {
      mutate: (id: string) => markRead.mutate({ id }),
      isPending: markRead.isPending,
    },
    markAllRead: {
      mutate: () => markAllRead.mutate(),
      isPending: markAllRead.isPending,
    },
    invalidateAll,
  };
}
