import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { ConnectionsListContainer } from "@/features/settings/ui/connections/connections-list-container";
import { ConnectionsSkeleton } from "@/features/settings/ui/connections/connections-skeleton";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("connections_title", "connections_desc");

export default async function ConnectionsPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl tracking-tight">{t("settings_connections_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("settings_connections_desc")}</p>
      </div>

      <Suspense fallback={<ConnectionsSkeleton />}>
        <ConnectionsSection />
      </Suspense>
    </div>
  );
}

async function ConnectionsSection() {
  await Promise.all([
    prefetch(trpcProxy.user.getLinkedAccounts.queryOptions()),
    prefetch(trpcProxy.githubApp.getMyGithubRepos.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <ConnectionsListContainer />
    </HydrateClient>
  );
}
