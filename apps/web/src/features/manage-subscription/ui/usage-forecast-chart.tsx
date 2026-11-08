"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/core/chart";

import {
  dayToDate,
  USAGE_CRITICAL_PERCENT,
  USAGE_WARNING_PERCENT,
  type UsageForecast,
  type UsageSeverity,
} from "../model/usage-forecast";
import { formatCompactNumber, formatUsageDate } from "../model/usage-format";

type Props = {
  forecast: UsageForecast;
  periodEnd: Date;
  periodStart: Date;
};

function severityClass(severity: UsageSeverity): string {
  if (severity === "critical") {
    return "text-destructive";
  }

  if (severity === "warning") {
    return "text-warning";
  }

  return "text-foreground";
}

function LegendItem({
  color,
  dashed,
  label,
}: Readonly<{ color: string; dashed?: boolean; label: string }>) {
  return (
    <span className="flex items-center gap-1.5">
      {dashed === true ? (
        <span
          className="h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: color }}
        />
      ) : (
        <span
          className="size-2 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  );
}

export function UsageForecastChart({ forecast, periodEnd, periodStart }: Readonly<Props>) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const id = useId();

  const usageColor =
    forecast.severity === "critical"
      ? "var(--status-error)"
      : forecast.severity === "warning"
        ? "var(--status-warning)"
        : "var(--primary)";
  const forecastColor = "var(--status-warning)";
  const limitColor = "var(--muted-foreground)";

  const fillId = `${id}-usage-fill`;
  const hatchId = `${id}-forecast-hatch`;

  const chartConfig = {
    actual: { color: usageColor, label: t("billing_usage_legend_usage") },
    forecast: { color: forecastColor, label: t("billing_usage_legend_forecast") },
  } satisfies ChartConfig;

  const xTicks = [
    ...new Set([
      1,
      forecast.daysElapsed,
      ...(forecast.hitDay == null ? [] : [forecast.hitDay]),
      forecast.daysTotal,
    ]),
  ].toSorted((left, right) => left - right);

  const hitDate =
    forecast.hitDay == null
      ? null
      : formatUsageDate(dayToDate(forecast.hitDay, periodStart), locale);

  const overLimit = forecast.percent >= USAGE_CRITICAL_PERCENT;
  const nearLimit = !overLimit && forecast.percent >= USAGE_WARNING_PERCENT;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className={cn(
              "font-semibold text-3xl tabular-nums tracking-tight",
              severityClass(forecast.severity),
            )}
          >
            {formatCompactNumber(Math.round(forecast.percent), locale)}%
          </span>
          {(overLimit || nearLimit) && (
            <AppBadge
              className={overLimit ? "" : "border-warning/40 text-warning"}
              variant={overLimit ? "destructive" : "outline"}
            >
              {t(overLimit ? "billing_usage_at_limit" : "billing_usage_near_limit")}
            </AppBadge>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
          <span>{t("billing_usage_resets", { date: formatUsageDate(periodEnd, locale) })}</span>
          <span>·</span>
          <span>
            {t("billing_usage_days", {
              elapsed: forecast.daysElapsed,
              total: forecast.daysTotal,
            })}
          </span>
          {forecast.projectable && (
            <>
              <span>·</span>
              <span className={severityClass(forecast.projectedSeverity)}>
                {t("billing_usage_forecast", {
                  date: formatUsageDate(periodEnd, locale),
                  percent: formatCompactNumber(Math.round(forecast.projectedPercent), locale),
                })}
              </span>
            </>
          )}
          {hitDate != null && (
            <>
              <span>·</span>
              <span
                className={severityClass(
                  forecast.projectedSeverity === "normal" ? "warning" : forecast.projectedSeverity,
                )}
              >
                {t("billing_usage_pace_hit", { date: hitDate })}
              </span>
            </>
          )}
        </p>
      </div>

      <ChartContainer
        className="h-52 w-full"
        config={chartConfig}
      >
        <ComposedChart
          data={forecast.chartRows}
          margin={{ bottom: 0, left: 0, right: 8, top: 8 }}
        >
          <defs>
            <linearGradient
              id={fillId}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={usageColor}
                stopOpacity={0.35}
              />
              <stop
                offset="95%"
                stopColor={usageColor}
                stopOpacity={0}
              />
            </linearGradient>
            <pattern
              height="7"
              id={hatchId}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
              width="7"
            >
              <rect
                fill={forecastColor}
                fillOpacity={0.06}
                height="7"
                width="7"
              />
              <line
                stroke={forecastColor}
                strokeOpacity={0.3}
                strokeWidth="2"
                x1="0"
                x2="0"
                y1="0"
                y2="7"
              />
            </pattern>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            strokeOpacity={1}
            vertical={false}
          />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            dataKey="day"
            domain={[1, forecast.daysTotal]}
            tickFormatter={(day: number) => formatUsageDate(dayToDate(day, periodStart), locale)}
            tickLine={false}
            tickMargin={8}
            ticks={xTicks}
            type="number"
          />
          <YAxis
            axisLine={false}
            domain={[0, forecast.axisMaxPercent]}
            tickFormatter={(value: number) => `${formatCompactNumber(value, locale)}%`}
            tickLine={false}
            width={44}
          />

          <ReferenceLine
            stroke={limitColor}
            strokeDasharray="4 4"
            y={100}
          />

          <Area
            connectNulls={false}
            dataKey="actual"
            fill={`url(#${fillId})`}
            isAnimationActive={false}
            stroke={usageColor}
            strokeWidth={2}
            type="monotone"
          />
          <Area
            connectNulls={false}
            dataKey="forecast"
            fill={`url(#${hatchId})`}
            isAnimationActive={false}
            stroke={forecastColor}
            strokeDasharray="5 4"
            strokeWidth={2}
            type="linear"
          />

          <ReferenceDot
            fill={usageColor}
            r={4}
            stroke="var(--background)"
            strokeWidth={2}
            x={forecast.daysElapsed}
            y={forecast.percent}
          />
          {forecast.hitDay != null && (
            <ReferenceDot
              fill={forecastColor}
              r={4}
              stroke="var(--background)"
              strokeWidth={2}
              x={forecast.hitDay}
              y={100}
            />
          )}

          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  const label =
                    name === "forecast"
                      ? t("billing_usage_legend_forecast")
                      : t("billing_usage_legend_usage");

                  return (
                    <>
                      <span
                        className="mt-0.5 size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium font-mono text-foreground tabular-nums">
                          {Math.round(Number(value))}%
                        </span>
                      </span>
                    </>
                  );
                }}
                indicator="dot"
                labelFormatter={(_, payload) => {
                  const day = payload[0]?.payload?.day as number | undefined;

                  return day == null ? "" : formatUsageDate(dayToDate(day, periodStart), locale);
                }}
              />
            }
            cursor={false}
          />
        </ComposedChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-muted-foreground text-xs">
        {forecast.projectable ? (
          <span>
            {t("billing_usage_average", {
              value: `${forecast.averagePercentPerDay.toFixed(1)}%`,
            })}
          </span>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <LegendItem
            color={usageColor}
            label={t("billing_usage_legend_usage")}
          />
          <LegendItem
            color={forecastColor}
            dashed
            label={t("billing_usage_legend_forecast")}
          />
          <LegendItem
            color={limitColor}
            dashed
            label={t("billing_usage_legend_limit")}
          />
        </div>
      </div>
    </div>
  );
}
