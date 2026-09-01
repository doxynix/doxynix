import { trpc } from "@/core/client";

export const notificationsService = {
  async list(limit = 15, isRead?: boolean) {
    return trpc.notification.getAll.query({
      cursor: 1,
      isRead,
      limit,
    });
  },

  async markAllAsRead() {
    return trpc.notification.markAllAsRead.mutate({});
  },
};
