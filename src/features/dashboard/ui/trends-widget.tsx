"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { trpc } from "@/shared/api/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/core/chart";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";

import { TrendsWidgetsSkeleton } from "./trends-widgets-skeleton";

export function TrendsWidget() {
  const { data, isLoading } = trpc.analytics.getTrends.useQuery();
  const t = useTranslations("Dashboard");
  const [activeTab, setActiveTab] = useState("overview");

  const chartConfig = {
    health: { label: "Health", color: "var(--chart-1)" },
    security: { label: "Security", color: "var(--chart-2)" },
    complexity: { label: "Complexity", color: "var(--chart-3)" },
    onboarding: { label: "Onboarding", color: "var(--chart-4)" },
    techDebt: { label: "Tech Debt", color: "var(--chart-5)" },
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
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="fillHealth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={healthColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={healthColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillSecurity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={securityColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={securityColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillComplexity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={complexityColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={complexityColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillOnboarding" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={onBoardingColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={onBoardingColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillTechDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={techDebtColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={techDebtColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={true} strokeDasharray="3 3" strokeOpacity={1} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
            />
            <YAxis domain={[0, 100]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            {activeTab === "overview" && (
              <Area
                key="health"
                dataKey="health"
                type="monotone"
                fill="url(#fillHealth)"
                stroke={healthColor}
              />
            )}
            {activeTab === "overview" && (
              <Area
                key="security"
                dataKey="security"
                type="monotone"
                fill="url(#fillSecurity)"
                stroke={securityColor}
              />
            )}

            {activeTab === "engineering" && (
              <Area
                key="complexity"
                dataKey="complexity"
                type="monotone"
                fill="url(#fillComplexity)"
                stroke={complexityColor}
              />
            )}
            {activeTab === "engineering" && (
              <Area
                key="onboarding"
                dataKey="onboarding"
                type="monotone"
                fill="url(#fillOnboarding)"
                stroke={onBoardingColor}
              />
            )}
            {activeTab === "engineering" && (
              <Area
                key="techDebt"
                dataKey="techDebt"
                type="monotone"
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
