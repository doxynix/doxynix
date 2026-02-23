"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { trpc } from "@/shared/api/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/core/chart";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

import { TrendsWidgetsSkeleton } from "./trends-widgets-skeleton";

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

  const healthColor = chartConfig.health.color;
  const securityColor = chartConfig.security.color;
  const complexityColor = chartConfig.complexity.color;
  const onBoardingColor = chartConfig.onboarding.color;
  const techDebtColor = chartConfig.techDebt.color;

  return (
    <Card className="border-primary/20 bg-card/50">
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
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-75 w-full">
          <AreaChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
            <defs>
              <linearGradient id="fillHealth" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={healthColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={healthColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillSecurity" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={securityColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={securityColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillComplexity" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={complexityColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={complexityColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillOnboarding" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={onBoardingColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={onBoardingColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillTechDebt" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={techDebtColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={techDebtColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical strokeDasharray="3 3" strokeOpacity={1} />
            <XAxis
              axisLine={false}
              dataKey="date"
              tickFormatter={(value) => value}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} cursor={false} />
            {activeTab === "overview" && (
              <Area
                key="health"
                type="monotone"
                dataKey="health"
                fill="url(#fillHealth)"
                stroke={healthColor}
              />
            )}
            {activeTab === "overview" && (
              <Area
                key="security"
                type="monotone"
                dataKey="security"
                fill="url(#fillSecurity)"
                stroke={securityColor}
              />
            )}

            {activeTab === "engineering" && (
              <Area
                key="complexity"
                type="monotone"
                dataKey="complexity"
                fill="url(#fillComplexity)"
                stroke={complexityColor}
              />
            )}
            {activeTab === "engineering" && (
              <Area
                key="onboarding"
                type="monotone"
                dataKey="onboarding"
                fill="url(#fillOnboarding)"
                stroke={onBoardingColor}
              />
            )}
            {activeTab === "engineering" && (
              <Area
                key="techDebt"
                type="monotone"
                dataKey="techDebt"
                fill="url(#fillTechDebt)"
                stroke={techDebtColor}
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
