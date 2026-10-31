"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/shared/ui/core/skeleton";

import { useWorkspace } from "@/entities/workspace/model/workspace-context";

import { useBillingState } from "../model/use-billing-state";
import { AccessStateBanner } from "./access-state-banner";
import { PlanCard } from "./plan-card";
import { SeatsCard } from "./seats-card";
import { UsageCard } from "./usage-card";

export function BillingSettingsPage() {
  const t = useTranslations("Billing");
  const { isOwner } = useWorkspace();
  const { data, isError, isLoading } = useBillingState();

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || data?.entitlement == null) {
    return <p className="text-muted-foreground text-sm">{t("billing_unavailable")}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <AccessStateBanner
        accessState={data.entitlement.accessState}
        graceEndsAt={data.entitlement.graceEndsAt}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanCard
          canManage={isOwner}
          entitlement={data.entitlement}
          subscription={data.subscription}
        />
        <UsageCard entitlement={data.entitlement} />
      </div>
      <SeatsCard
        activeMembers={data.activeMembers}
        isOwner={isOwner}
        planCode={data.entitlement.planCode}
        seatLimit={data.entitlement.seatLimit}
        subscription={data.subscription}
      />
    </div>
  );
}
