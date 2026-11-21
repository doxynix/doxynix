"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { formatShortDate } from "@/shared/lib/date-utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/core/card";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { BillingEntitlement, BillingSubscription } from "../model/billing.types";
import { useSubscriptionActions } from "../model/use-subscription-actions";
import { BillingStateBadge } from "./billing-state-badge";

type PlanCode = BillingEntitlement["planCode"];

// TEAM has no copy yet, so it keeps the raw code in the label and reuses the paid description.
const PLAN_COPY: Record<
  PlanCode,
  {
    description: "billing_plan_hobby_desc" | "billing_plan_pro_desc";
    label: "billing_plan_hobby" | "billing_plan_pro" | null;
  }
> = {
  HOBBY: { description: "billing_plan_hobby_desc", label: "billing_plan_hobby" },
  PRO: { description: "billing_plan_pro_desc", label: "billing_plan_pro" },
  TEAM: { description: "billing_plan_pro_desc", label: null },
};

type Props = {
  canManage: boolean;
  entitlement: BillingEntitlement;
  subscription: BillingSubscription | null;
};

export function PlanCard({ canManage, entitlement, subscription }: Readonly<Props>) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { checkout, portal } = useSubscriptionActions();
  const [error, setError] = useState<null | string>(null);

  const isHobby = entitlement.planCode === "HOBBY";
  const canUpgrade = isHobby || subscription == null;
  const planCopy = PLAN_COPY[entitlement.planCode];
  const planName = planCopy.label == null ? entitlement.planCode : t(planCopy.label);
  const pending = checkout.isPending || portal.isPending;

  const periodLabel =
    subscription == null
      ? null
      : `${t(
          subscription.cancelAtPeriodEnd ? "billing_ends_on_label" : "billing_renews_on_label",
        )} ${formatShortDate(subscription.currentPeriodEnd, locale)}`;

  const startCheckout = () => {
    setError(null);
    checkout.mutate(
      { requestId: crypto.randomUUID() },
      {
        onError: (error) => setError(errorMessage(error)),
        onSuccess: ({ url }) => {
          if (url == null) {
            setError(t("billing_error_checkout_url_missing"));
          }
        },
      },
    );
  };

  const openPortal = () => {
    setError(null);
    portal.mutate(
      { requestId: crypto.randomUUID(), returnPath: "/dashboard/settings/billing" },
      { onError: (error) => setError(errorMessage(error)) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{planName}</CardTitle>
        <CardDescription>{periodLabel ?? t(planCopy.description)}</CardDescription>
        <CardAction>
          <BillingStateBadge state={entitlement.accessState} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {periodLabel != null && (
          <p className="text-muted-foreground text-sm">{t(planCopy.description)}</p>
        )}
        <p
          aria-live="polite"
          className="min-h-5 text-destructive text-sm"
        >
          {error ?? ""}
        </p>
      </CardContent>
      <CardFooter className="mt-auto justify-end border-t">
        {canManage ? (
          <LoadingButton
            isLoading={pending}
            onClick={canUpgrade ? startCheckout : openPortal}
            size="sm"
            variant={canUpgrade ? "default" : "outline"}
          >
            {canUpgrade ? t("billing_upgrade") : t("billing_manage")}
          </LoadingButton>
        ) : (
          <p className="text-muted-foreground text-sm">{t("billing_read_only")}</p>
        )}
      </CardFooter>
    </Card>
  );
}
