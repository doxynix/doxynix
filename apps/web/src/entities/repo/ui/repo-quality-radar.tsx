"use client";

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
  const chartData = [
    { fullMark: 100, subject: "Health", value: scores.health },
    { fullMark: 100, subject: "Security", value: scores.security },
    { fullMark: 100, subject: "Simplicity", value: 100 - scores.complexity },
    { fullMark: 100, subject: "Onboarding", value: scores.onboarding },
    { fullMark: 100, subject: "Maintainability", value: 100 - scores.techDebt },
  ];

  const config = {
    value: { color: "var(--chart-1)", label: "Score" },
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
            name="Quality"
            stroke="var(--background)"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
