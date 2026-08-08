"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/core/chart";

type Props = Readonly<{
  activeTab: string;
  chartConfig: ChartConfig;
  data: Array<{
    complexity: number;
    date: string;
    health: number;
    onboarding: number;
    security: number;
    techDebt: number;
  }>;
}>;

export function TrendsChart({ activeTab, chartConfig, data }: Props) {
  const healthColor = chartConfig.health?.color as string;
  const securityColor = chartConfig.security?.color as string;
  const complexityColor = chartConfig.complexity?.color as string;
  const onBoardingColor = chartConfig.onboarding?.color as string;
  const techDebtColor = chartConfig.techDebt?.color as string;

  return (
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
  );
}
