"use client";

import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";

import type { BillingEntitlement } from "../model/billing.types";

type Props = {
  entitlement: BillingEntitlement;
};

// `Intl.NumberFormat` is the only correct tool here; es-toolkit's `compact` filters falsy array
// items, it does not format numbers. Formatters are cached because each instance is expensive.
const compactFormatters = new Map<string, Intl.NumberFormat>();

function formatCompactNumber(value: number, locale: string): string {
  let formatter = compactFormatters.get(locale);

  if (formatter == null) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      notation: "compact",
    });
    compactFormatters.set(locale, formatter);
  }

  return formatter.format(value);
}

function UsageRow({
  label,
  limit,
  used,
}: Readonly<{ label: string; limit: null | number; used: number }>) {
  const t = useTranslations("Billing");
  const locale = useLocale();

  const value =
    limit == null
      ? formatCompactNumber(used, locale)
      : `${formatCompactNumber(used, locale)} / ${formatCompactNumber(limit, locale)}`;
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
