import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import type { PageProps } from "@/shared/lib/next.types";
import { hasAnySearchParam } from "@/shared/lib/url-state";

import {
  NOTIFICATIONS_DEFAULT_LIMIT,
  notificationsParsers,
} from "@/entities/notification/model/notifications-parsers";

import { NotificationsListContainer } from "@/features/notifications/ui/notifications-list-container";
import { NotificationsListSkeleton } from "@/features/notifications/ui/notifications-list-skeleton";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("notifications_title", "notifications_desc");

export default async function NotificationsPage({ searchParams }: Readonly<PageProps>) {
  const t = await getTranslations("Dashboard");
  const query = await searchParams;
  const shouldPrefetch = !hasAnySearchParam(query, Object.keys(notificationsParsers));

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <h1 className="font-bold text-2xl">{t("notifications_title")}</h1>
      <Suspense fallback={<NotificationsListSkeleton count={NOTIFICATIONS_DEFAULT_LIMIT} />}>
        <NotificationsSection prefetchList={shouldPrefetch} />
      </Suspense>
    </div>
  );
}

async function NotificationsSection({ prefetchList }: Readonly<{ prefetchList: boolean }>) {
  if (prefetchList) {
    await prefetch(
      trpcProxy.notification.getAll.queryOptions({
        limit: NOTIFICATIONS_DEFAULT_LIMIT,
        page: 1,
      }),
    );
  }

  return (
    <HydrateClient>
      <NotificationsListContainer />
    </HydrateClient>
  );
}
