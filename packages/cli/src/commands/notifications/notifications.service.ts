import { trpc } from "@/core/client";

export const notificationsService = {
  async deleteOne(id: string) {
    return trpc.notification.deleteOne.mutate({ id });
  },

  async deleteRead() {
    return trpc.notification.deleteRead.mutate({});
  },

  async getStats() {
    return trpc.notification.getStats.query({});
  },
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

  async markAs(id: string, isRead: boolean) {
    return trpc.notification.markAs.mutate({ id, isRead });
  },
};
