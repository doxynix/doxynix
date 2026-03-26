import type { Prisma } from "@prisma/client";

import type { PaginationMeta } from "@/server/utils/pagination";

export type NotificationWithRepo = Prisma.NotificationGetPayload<{
  include: {
    repo: {
      select: {
        name: true;
        owner: true;
      };
    };
  };
}>;

export const notificationPresenter = {
  toPaginatedList(items: NotificationWithRepo[], meta: PaginationMeta) {
    return {
      items: items.map((item) => this.toPublic(item)),
      meta,
    };
  },

  toPublic(n: NotificationWithRepo) {
    return {
      ...n,
      id: n.publicId,
      repo: n.repo != null ? { name: n.repo.name, owner: n.repo.owner } : null,
    };
  },
};
