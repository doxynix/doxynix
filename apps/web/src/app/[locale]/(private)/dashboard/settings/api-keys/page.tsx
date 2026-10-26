import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { ApiKeysListContainer } from "@/features/api-keys/ui/api-keys-list-container";
import { CreateApiKeyDialog } from "@/features/api-keys/ui/create-api-key-dialog";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("api_keys_title", "api_keys_desc");

export default async function ApiKeysPage() {
  const t = await getTranslations("Dashboard");

  await prefetch(trpcProxy.apikey.list.queryOptions());

  return (
    <HydrateClient>
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="font-bold text-2xl tracking-tight">{t("settings_api_keys_title")}</h2>
            <p className="text-muted-foreground text-sm">{t("settings_api_keys_desc")}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lg">{t("settings_api_keys_active_keys")}</h3>
          <CreateApiKeyDialog />
        </div>
        <ApiKeysListContainer />
      </div>
    </HydrateClient>
  );
}
