"use client";

import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
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

export function AnalyticsSection() {
  const t = useTranslations("Landing");

  const chartConfig = {
    complexity: {
      color: "var(--chart-1)",
      label: t("section_analytics_complexity_label"),
    },
    docs: {
      color: "var(--chart-2)",
      label: t("section_analytics_docs_coverage"),
    },
  } satisfies ChartConfig;

  return (
    <section className="relative container mx-auto px-4 py-24">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold md:text-5xl">
          {t("section_analytics_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_analytics_title_highlight")}</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">{t("section_analytics_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Card className="border-primary bg-landing-bg-light/50 col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>{t("section_analytics_card_title")}</CardTitle>
            <CardDescription>{t("section_analytics_card_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <stop offset="5%" stopColor="var(--color-docs)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-docs)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillComplexity" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-complexity)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-complexity)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <Area
                  type="natural"
                  dataKey="docs"
                  fill="url(#fillDocs)"
                  stroke="var(--color-docs)"
                />
                <Area
                  type="natural"
                  dataKey="complexity"
                  fill="url(#fillComplexity)"
                  stroke="var(--color-complexity)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-primary bg-landing-bg-light/50 flex flex-1 flex-col justify-center p-6">
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              {t("section_analytics_bus_factor")}
            </p>
            <span className="text-destructive mt-2 text-5xl font-bold">1.2</span>
            <p className="text-muted-foreground mt-2 text-xs">{t("section_analytics_review")}</p>
          </Card>
          <Card className="border-primary bg-landing-bg-light/50 flex flex-1 flex-col justify-center p-6">
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              {t("section_analytics_maintain")}
            </p>
            <span className="text-success mt-2 text-5xl font-bold">A+</span>
            <div className="text-muted-foreground mt-2 text-xs">
              {t("section_analytics_improve")}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
