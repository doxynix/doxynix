import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { BillingSettingsPage } from "@/features/manage-subscription/ui/billing-settings-page";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("billing_title", "billing_desc");

export default async function BillingPage() {
  const t = await getTranslations("Billing");

  await prefetch(trpcProxy.billing.getState.queryOptions());

  return (
    <HydrateClient>
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-2xl tracking-tight">{t("billing_title")}</h2>
          <p className="text-muted-foreground text-sm">{t("billing_desc")}</p>
        </div>
        <BillingSettingsPage />
      </div>
    </HydrateClient>
  );
}
