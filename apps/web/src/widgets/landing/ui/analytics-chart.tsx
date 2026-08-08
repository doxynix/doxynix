"use client";

import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/core/chart";

const chartData = [
  { complexity: 186, docs: 80, month: "Jan" },
  { complexity: 305, docs: 200, month: "Feb" },
  { complexity: 237, docs: 120, month: "Mar" },
  { complexity: 73, docs: 190, month: "Apr" },
  { complexity: 209, docs: 130, month: "May" },
  { complexity: 214, docs: 140, month: "Jun" },
];

export function AnalyticsChart() {
  const t = useTranslations("Landing");

  const chartConfig = {
    complexity: {
      color: "var(--chart-4)",
      label: t("section_analytics_complexity_label"),
    },
    docs: {
      color: "var(--chart-2)",
      label: t("section_analytics_docs_coverage"),
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="max-h-75 w-full">
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="month"
          tickFormatter={(value) => value.slice(0, 3)}
          tickLine={false}
          tickMargin={8}
        />

        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} cursor={false} />

        <defs>
          <linearGradient id="fillDocs" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillComplexity" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0.1} />
          </linearGradient>
        </defs>

        <Area type="natural" dataKey="docs" fill="url(#fillDocs)" stroke="var(--chart-2)" />
        <Area
          type="natural"
          dataKey="complexity"
          fill="url(#fillComplexity)"
          stroke="var(--chart-4)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
