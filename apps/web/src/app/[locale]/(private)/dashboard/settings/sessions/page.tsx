import { getTranslations } from "next-intl/server";

import { SESSIONS_PAGE_SIZE } from "@/shared/config/pagination";
import { createMetadata } from "@/shared/lib/metadata";

import { SessionsList } from "@/features/settings/ui/sessions/sessions-list";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("sessions_title", "sessions_desc");

export default async function SessionsSettingsPage() {
  const t = await getTranslations("Sessions");

  await prefetch(
    trpcProxy.user.getActiveSessions.infiniteQueryOptions(
      { limit: SESSIONS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  return (
    <HydrateClient>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">{t("page_title")}</h1>
          <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
        </div>

        <SessionsList />
      </div>
    </HydrateClient>
  );
}
