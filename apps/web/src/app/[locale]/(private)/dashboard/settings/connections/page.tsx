import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { ConnectionsListContainer } from "@/features/settings/ui/connections/connections-list-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("connections_title", "connections_desc");

export default async function ConnectionsPage() {
  const t = await getTranslations("Dashboard");

  await prefetch(trpcProxy.user.getLinkedAccounts.queryOptions());

  return (
    <HydrateClient>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl tracking-tight">{t("settings_connections_title")}</h1>
          <p className="text-muted-foreground text-sm">{t("settings_connections_desc")}</p>
        </div>

        <ConnectionsListContainer />
      </div>
    </HydrateClient>
  );
}
