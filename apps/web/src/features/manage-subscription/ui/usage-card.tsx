"use client";

import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";

import type { BillingEntitlement } from "../model/types";

type Props = {
  entitlement: BillingEntitlement;
};

function compact(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function UsageRow({
  label,
  limit,
  used,
}: Readonly<{ label: string; limit: null | number; used: number }>) {
  const t = useTranslations("Billing");
  const locale = useLocale();

  const value =
    limit == null ? compact(used, locale) : `${compact(used, locale)} / ${compact(limit, locale)}`;
  const percent = limit == null || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {value}
          {limit == null && (
            <span className="text-muted-foreground"> · {t("billing_usage_unlimited")}</span>
          )}
        </span>
      </div>
      {limit != null && <Progress value={percent} />}
    </div>
  );
}

export function UsageCard({ entitlement }: Readonly<Props>) {
  const t = useTranslations("Billing");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing_usage_title")}</CardTitle>
        <CardDescription>{t("billing_usage_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <UsageRow
          label={t("billing_usage_analyses")}
          limit={entitlement.analysesPerMonth}
          used={entitlement.usedAnalyses}
        />
        <UsageRow
          label={t("billing_usage_tokens")}
          limit={entitlement.aiTokensPerMonth}
          used={entitlement.usedTokens}
        />
      </CardContent>
    </Card>
  );
}
