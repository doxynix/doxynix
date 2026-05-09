"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import type { ChartConfig } from "@/shared/ui/core/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

import { dashboardParsers } from "../model/dashboard-parsers";
import { TrendsWidgetsSkeleton } from "./trends-widgets-skeleton";

const TrendsChart = dynamic(() => import("./trends-chart").then((m) => m.TrendsChart), {
  loading: () => <div className="h-75 w-full" />,
  ssr: false,
});

type Props = { className?: string; repoId?: string };

export function TrendsWidget({ className, repoId }: Readonly<Props>) {
  const [urlParams] = useQueryStates(dashboardParsers);

  const { data, isLoading } = trpc.analytics.getTrends.useQuery({
    from: urlParams.from ?? undefined,
    period: urlParams.period,
    repoId: repoId ?? undefined,
    to: urlParams.to ?? undefined,
  });

  const t = useTranslations("Dashboard");
  const [activeTab, setActiveTab] = useState("overview");

  const chartConfig = {
    complexity: { color: "var(--chart-3)", label: "Complexity" },
    health: { color: "var(--chart-1)", label: "Health" },
    onboarding: { color: "var(--chart-4)", label: "Onboarding" },
    security: { color: "var(--chart-2)", label: "Security" },
    techDebt: { color: "var(--chart-5)", label: "Tech Debt" },
  } satisfies ChartConfig;

  if (isLoading) {
    return <TrendsWidgetsSkeleton />;
  }

  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle className="text-xl">{t("trends_title")}</CardTitle>
          <CardDescription>{t("trends_desc")}</CardDescription>
        </div>
        <div className="flex items-center px-6 py-4 sm:py-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-auto">
            <TabsList className="flex items-center gap-1">
              <TabsTrigger value="overview" className="text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger value="engineering" className="text-xs">
                Engineering
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="sr-only" />
            <TabsContent value="engineering" className="sr-only" />
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {hasData === false ? (
          <div className="flex h-80 w-full flex-col items-center justify-center gap-2 rounded-xl border">
            <p className="text-muted-foreground text-sm">No data</p>
          </div>
        ) : (
          <TrendsChart activeTab={activeTab} chartConfig={chartConfig} data={data} />
        )}
      </CardContent>
    </Card>
  );
}
