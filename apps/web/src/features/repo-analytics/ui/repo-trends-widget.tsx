"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/core/card";
import type { ChartConfig } from "@/shared/ui/core/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { ErrorState } from "@/shared/ui/kit/error-state";

import { dashboardParsers, dashboardRangeInput } from "../model/dashboard-parsers";
import { TrendsWidgetsSkeleton } from "./repo-trends-widget-skeleton";

const TrendsChart = dynamic(() => import("./repo-trends-chart").then((m) => m.TrendsChart), {
  loading: () => <div className="h-75 w-full" />,
  ssr: false,
});

type Props = { className?: string; repoId?: string };

function TrendLegend({ items }: Readonly<{ items: { color: string; label: string }[] }>) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
      {items.map((item) => (
        <span
          className="flex items-center gap-1.5"
          key={item.label}
        >
          <span
            className="size-2 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function TrendsWidget({ className, repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const [urlParams] = useQueryStates(dashboardParsers);

  const { data, error, isError, isLoading, refetch } = useQuery(
    trpc.analytics.getTrends.queryOptions({
      ...dashboardRangeInput(urlParams),
      repoId: repoId ?? undefined,
    }),
  );

  const t = useTranslations("Dashboard");
  const [activeTab, setActiveTab] = useState("overview");

  const chartConfig = {
    complexity: { color: "var(--chart-3)", label: t("quality_complexity") },
    health: { color: "var(--chart-1)", label: t("quality_health") },
    onboarding: { color: "var(--chart-4)", label: t("quality_onboarding") },
    security: { color: "var(--chart-2)", label: t("quality_security") },
    techDebt: { color: "var(--chart-5)", label: t("quality_tech_debt") },
  } satisfies ChartConfig;

  const legendItems =
    activeTab === "overview"
      ? [
          { color: "var(--chart-1)", label: t("quality_health") },
          { color: "var(--chart-2)", label: t("quality_security") },
        ]
      : [
          { color: "var(--chart-3)", label: t("quality_complexity") },
          { color: "var(--chart-4)", label: t("quality_onboarding") },
          { color: "var(--chart-5)", label: t("quality_tech_debt") },
        ];

  if (isLoading) {
    return <TrendsWidgetsSkeleton />;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{t("trends_title")}</CardTitle>
        <CardDescription>{t("trends_desc")}</CardDescription>

        <CardAction>
          <Tabs
            className="gap-0"
            onValueChange={setActiveTab}
            value={activeTab}
          >
            <TabsList className="h-8 gap-0.5 p-0.5">
              <TabsTrigger
                className="px-2.5 py-1 text-xs"
                value="overview"
              >
                {t("repo_trends_tab_overview")}
              </TabsTrigger>
              <TabsTrigger
                className="px-2.5 py-1 text-xs"
                value="engineering"
              >
                {t("repo_trends_tab_engineering")}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              className="sr-only"
              value="overview"
            />
            <TabsContent
              className="sr-only"
              value="engineering"
            />
          </Tabs>
        </CardAction>
      </CardHeader>

      <CardContent>
        {isError || data == null ? (
          <ErrorState
            error={error}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <div className="flex h-80 w-full items-center justify-center">
            <p className="text-muted-foreground text-sm">{t("repo_trends_no_data")}</p>
          </div>
        ) : (
          <>
            <TrendsChart
              activeTab={activeTab}
              chartConfig={chartConfig}
              data={data}
            />
            <TrendLegend items={legendItems} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
