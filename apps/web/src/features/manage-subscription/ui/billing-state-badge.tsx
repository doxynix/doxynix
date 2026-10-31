"use client";

import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";

import type { BillingAccessState } from "../model/billing.types";

const STATE_VARIANT: Record<
  BillingAccessState,
  "default" | "destructive" | "outline" | "secondary"
> = {
  ACTIVE: "default",
  CANCELED: "destructive",
  GRACE: "secondary",
  NO_SUBSCRIPTION: "outline",
  PENDING: "outline",
  REVIEW: "destructive",
  SUSPENDED: "destructive",
};

function stateKey(state: BillingAccessState): string {
  switch (state) {
    case "ACTIVE": {
      return "billing_state_active";
    }
    case "CANCELED": {
      return "billing_state_canceled";
    }
    case "GRACE": {
      return "billing_state_grace";
    }
    case "NO_SUBSCRIPTION": {
      return "billing_state_no_subscription";
    }
    case "PENDING": {
      return "billing_state_pending";
    }
    case "REVIEW": {
      return "billing_state_review";
    }
    case "SUSPENDED": {
      return "billing_state_suspended";
    }
  }
}

export function BillingStateBadge({ state }: Readonly<{ state: BillingAccessState }>) {
  const t = useTranslations("Billing");

  return <AppBadge variant={STATE_VARIANT[state]}>{t(stateKey(state))}</AppBadge>;
}
