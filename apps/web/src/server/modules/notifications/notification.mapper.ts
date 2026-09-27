import type { Notification, PaginationMeta } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

type NotificationWithRepo = Prisma.NotificationGetPayload<{
  include: {
    repo: {
      select: {
        name: true;
        owner: true;
      };
    };
  };
}>;

export const notificationMapper = {
  toPaginatedList(items: NotificationWithRepo[], meta: PaginationMeta) {
    return {
      items: items.map((item) => this.toPublic(item)),
      meta,
    };
  },

  toPublic(n: NotificationWithRepo): Notification {
    return {
      body: n.body,
      createdAt: n.createdAt,
      id: n.id,
      isRead: n.isRead,
      repo: n.repo != null ? { name: n.repo.name, owner: n.repo.owner } : null,
      title: n.title,
      type: n.type,
      updatedAt: n.updatedAt,
    };
  },
};
