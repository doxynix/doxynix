"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import type { ChartConfig } from "@/shared/ui/core/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

import { TrendsWidgetsSkeleton } from "./trends-widgets-skeleton";

const TrendsChart = dynamic(() => import("./trends-chart").then((m) => m.TrendsChart), {
  loading: () => <TrendsWidgetsSkeleton />,
  ssr: false,
});

export function TrendsWidget() {
  const { data, isLoading } = trpc.analytics.getTrends.useQuery();
  const t = useTranslations("Dashboard");
  const [activeTab, setActiveTab] = useState("overview");

  const chartConfig = {
    complexity: { color: "var(--chart-3)", label: "Complexity" },
    health: { color: "var(--chart-1)", label: "Health" },
    onboarding: { color: "var(--chart-4)", label: "Onboarding" },
    security: { color: "var(--chart-2)", label: "Security" },
    techDebt: { color: "var(--chart-5)", label: "Tech Debt" },
  } satisfies ChartConfig;

  if (isLoading || !data) {
    return <TrendsWidgetsSkeleton />;
  }

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle className="text-xl">{t("trends_title")}</CardTitle>
          <CardDescription>{t("trends_desc")}</CardDescription>
        </div>
        <div className="flex items-center px-6 py-4 sm:py-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-auto">
            <TabsList>
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
        <TrendsChart activeTab={activeTab} chartConfig={chartConfig} data={data} />
      </CardContent>
    </Card>
  );
}
