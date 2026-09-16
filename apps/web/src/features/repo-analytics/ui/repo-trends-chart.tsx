"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  const id = useId();

  const fillHealthId = `${id}-fill-health`;
  const fillSecurityId = `${id}-fill-security`;
  const fillComplexityId = `${id}-fill-complexity`;
  const fillOnboardingId = `${id}-fill-onboarding`;
  const fillTechDebtId = `${id}-fill-tech-debt`;

  const healthColor = chartConfig.health?.color as string;
  const securityColor = chartConfig.security?.color as string;
  const complexityColor = chartConfig.complexity?.color as string;
  const onBoardingColor = chartConfig.onboarding?.color as string;
  const techDebtColor = chartConfig.techDebt?.color as string;

  return (
    <ChartContainer
      className="h-75 w-full"
      config={chartConfig}
    >
      <AreaChart
        data={data}
        margin={{ bottom: 0, left: 0, right: 0, top: 10 }}
      >
        <defs>
          <linearGradient
            id={fillHealthId}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={healthColor}
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor={healthColor}
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient
            id={fillSecurityId}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={securityColor}
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor={securityColor}
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient
            id={fillComplexityId}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={complexityColor}
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor={complexityColor}
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient
            id={fillOnboardingId}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={onBoardingColor}
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor={onBoardingColor}
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient
            id={fillTechDebtId}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor={techDebtColor}
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor={techDebtColor}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          strokeOpacity={1}
          vertical
        />
        <XAxis
          axisLine={false}
          dataKey="date"
          tickFormatter={(value) => value}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis domain={[0, 100]} />
        <ChartTooltip
          content={<ChartTooltipContent indicator="dot" />}
          cursor={false}
        />
        {activeTab === "overview" && (
          <Area
            dataKey="health"
            fill={`url(#${fillHealthId})`}
            key="health"
            stroke={healthColor}
            type="monotone"
          />
        )}
        {activeTab === "overview" && (
          <Area
            dataKey="security"
            fill={`url(#${fillSecurityId})`}
            key="security"
            stroke={securityColor}
            type="monotone"
          />
        )}

        {activeTab === "engineering" && (
          <Area
            dataKey="complexity"
            fill={`url(#${fillComplexityId})`}
            key="complexity"
            stroke={complexityColor}
            type="monotone"
          />
        )}
        {activeTab === "engineering" && (
          <Area
            dataKey="onboarding"
            fill={`url(#${fillOnboardingId})`}
            key="onboarding"
            stroke={onBoardingColor}
            type="monotone"
          />
        )}
        {activeTab === "engineering" && (
          <Area
            dataKey="techDebt"
            fill={`url(#${fillTechDebtId})`}
            key="techDebt"
            stroke={techDebtColor}
            type="monotone"
          />
        )}
      </AreaChart>
    </ChartContainer>
  );
}
