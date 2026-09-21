"use client";

import { useTranslations } from "next-intl";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/core/chart";

type QualityRadarProps = {
  scores: {
    complexity: number;
    health: number;
    onboarding: number;
    security: number;
    techDebt: number;
  };
};

export function QualityRadar({ scores }: Readonly<QualityRadarProps>) {
  const t = useTranslations("Dashboard");

  const chartData = [
    { fullMark: 100, subject: t("quality_health"), value: scores.health },
    { fullMark: 100, subject: t("quality_security"), value: scores.security },
    { fullMark: 100, subject: t("quality_simplicity"), value: 100 - scores.complexity },
    { fullMark: 100, subject: t("quality_onboarding"), value: scores.onboarding },
    { fullMark: 100, subject: t("quality_maintainability"), value: 100 - scores.techDebt },
  ];

  const config = {
    value: { color: "var(--chart-1)", label: t("quality_score") },
  };

  return (
    <ChartContainer
      className="h-75 w-full"
      config={config}
    >
      <ResponsiveContainer
        height="100%"
        width="100%"
      >
        <RadarChart
          cx="50%"
          cy="50%"
          data={chartData}
          outerRadius="80%"
        >
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
          />
          <Radar
            dataKey="value"
            fill="var(--foreground)"
            fillOpacity={0.3}
            stroke="var(--background)"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
