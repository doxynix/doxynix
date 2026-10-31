"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatShortDate } from "@/shared/lib/date-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { billingErrorKey } from "../model/billing-errors";
import type { BillingEntitlement, BillingSubscription } from "../model/types";
import { useSubscriptionActions } from "../model/use-subscription-actions";
import { BillingStateBadge } from "./billing-state-badge";

type Props = {
  canManage: boolean;
  entitlement: BillingEntitlement;
  subscription: BillingSubscription | null;
};

export function PlanCard({ canManage, entitlement, subscription }: Readonly<Props>) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const { checkout, portal } = useSubscriptionActions();
  const [errorKey, setErrorKey] = useState<null | string>(null);

  const isHobby = entitlement.planCode === "HOBBY";
  const canUpgrade = isHobby || subscription == null;
  const pending = checkout.isPending || portal.isPending;

  const startCheckout = () => {
    setErrorKey(null);
    checkout.mutate(
      { requestId: crypto.randomUUID() },
      {
        onError: (error) => setErrorKey(billingErrorKey(error)),
        onSuccess: ({ url }) => {
          if (url == null) {
            setErrorKey("billing_error_checkout_url_missing");
          }
        },
      },
    );
  };

  const openPortal = () => {
    setErrorKey(null);
    portal.mutate(
      { returnPath: "/dashboard/settings/billing" },
      { onError: (error) => setErrorKey(billingErrorKey(error)) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing_plan_title")}</CardTitle>
        <CardDescription>
          {entitlement.planCode === "HOBBY"
            ? t("billing_plan_hobby_desc")
            : t("billing_plan_pro_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">{t("billing_plan_current")}</span>
          <span className="font-semibold">
            {entitlement.planCode === "HOBBY"
              ? t("billing_plan_hobby")
              : entitlement.planCode === "PRO"
                ? t("billing_plan_pro")
                : entitlement.planCode}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">{t("billing_state_label")}</span>
          <BillingStateBadge state={entitlement.accessState} />
        </div>
        {subscription != null && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              {subscription.cancelAtPeriodEnd
                ? t("billing_ends_on_label")
                : t("billing_renews_on_label")}
            </span>
            <span className="text-sm">
              {formatShortDate(subscription.currentPeriodEnd, locale)}
            </span>
          </div>
        )}
        {canManage ? (
          <LoadingButton
            className="w-full"
            isLoading={pending}
            onClick={canUpgrade ? startCheckout : openPortal}
          >
            {canUpgrade ? t("billing_upgrade") : t("billing_manage")}
          </LoadingButton>
        ) : (
          <p className="text-muted-foreground text-sm">{t("billing_read_only")}</p>
        )}
        {errorKey != null && <p className="text-destructive text-sm">{t(errorKey)}</p>}
      </CardContent>
    </Card>
  );
}
