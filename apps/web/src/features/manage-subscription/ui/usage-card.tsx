"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/core/toggle-group";

import type { BillingEntitlement, BillingUsage } from "../model/billing.types";
import { buildUsageForecast, type UsageForecast } from "../model/usage-forecast";
import { formatCompactNumber } from "../model/usage-format";
import { UsageForecastChart } from "./usage-forecast-chart";

type Metric = "analyses" | "tokens";

type Props = {
  entitlement: BillingEntitlement;
  usage: BillingUsage;
};

function UsageRow({
  forecast,
  label,
  limit,
  used,
}: Readonly<{ forecast: UsageForecast; label: string; limit: null | number; used: number }>) {
  const t = useTranslations("Billing");
  const locale = useLocale();

  const value =
    limit == null
      ? `${formatCompactNumber(used, locale)} · ${t("billing_usage_unlimited")}`
      : `${formatCompactNumber(used, locale)} / ${formatCompactNumber(limit, locale)}`;
  const percentClass =
    forecast.severity === "critical"
      ? "text-destructive"
      : forecast.severity === "warning"
        ? "text-warning"
        : "text-muted-foreground";
  const indicatorClass =
    forecast.severity === "critical"
      ? "bg-destructive"
      : forecast.severity === "warning"
        ? "bg-warning"
        : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-2 tabular-nums">
          {limit != null && (
            <span className={cn("font-medium text-xs", percentClass)}>
              {Math.round(forecast.percent)}%
            </span>
          )}
          <span>{value}</span>
        </span>
      </div>
      {limit != null && (
        <Progress
          indicatorClassName={indicatorClass}
          value={forecast.percent}
        />
      )}
    </div>
  );
}

export function UsageCard({ entitlement, usage }: Readonly<Props>) {
  const t = useTranslations("Billing");
  const now = usage.now;

  const limits: Record<Metric, null | number> = {
    analyses: entitlement.analysesPerMonth,
    tokens: entitlement.aiTokensPerMonth,
  };
  const forecasts: Record<Metric, UsageForecast> = {
    analyses: buildUsageForecast({
      limit: limits.analyses,
      now,
      periodEnd: usage.periodEnd,
      periodStart: usage.periodStart,
      series: usage.days.map((day) => ({ date: day.date, value: day.analyses })),
      used: entitlement.usedAnalyses,
    }),
    tokens: buildUsageForecast({
      limit: limits.tokens,
      now,
      periodEnd: usage.periodEnd,
      periodStart: usage.periodStart,
      series: usage.days.map((day) => ({ date: day.date, value: day.tokens })),
      used: entitlement.usedTokens,
    }),
  };

  const [metric, setMetric] = useState<Metric>(() =>
    forecasts.tokens.percent > forecasts.analyses.percent ? "tokens" : "analyses",
  );

  const activeLimit = limits[metric];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing_usage_title")}</CardTitle>
        <CardDescription>{t("billing_usage_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <UsageRow
          forecast={forecasts.analyses}
          label={t("billing_usage_analyses")}
          limit={limits.analyses}
          used={entitlement.usedAnalyses}
        />
        <UsageRow
          forecast={forecasts.tokens}
          label={t("billing_usage_tokens")}
          limit={limits.tokens}
          used={entitlement.usedTokens}
        />

        <div className="flex flex-col gap-4 border-t pt-4">
          <ToggleGroup
            className="self-start"
            onValueChange={(value) => {
              if (value !== "") {
                setMetric(value as Metric);
              }
            }}
            type="single"
            value={metric}
            variant="outline"
          >
            <ToggleGroupItem
              className="text-xs"
              size="sm"
              value="analyses"
            >
              {t("billing_usage_analyses")}
            </ToggleGroupItem>
            <ToggleGroupItem
              className="text-xs"
              size="sm"
              value="tokens"
            >
              {t("billing_usage_tokens")}
            </ToggleGroupItem>
          </ToggleGroup>

          {activeLimit == null ? (
            <p className="text-muted-foreground text-sm">{t("billing_usage_unlimited")}</p>
          ) : (
            <UsageForecastChart
              forecast={forecasts[metric]}
              periodEnd={usage.periodEnd}
              periodStart={usage.periodStart}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
