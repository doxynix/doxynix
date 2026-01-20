"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";

const chartData = [
  { month: "Jan", complexity: 186, docs: 80 },
  { month: "Feb", complexity: 305, docs: 200 },
  { month: "Mar", complexity: 237, docs: 120 },
  { month: "Apr", complexity: 73, docs: 190 },
  { month: "May", complexity: 209, docs: 130 },
  { month: "Jun", complexity: 214, docs: 140 },
];

const chartConfig = {
  complexity: {
    label: "Complexity",
    color: "hsl(var(--chart-1))",
  },
  docs: {
    label: "Docs Coverage",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function AnalyticsSection() {
  return (
    <section className="relative z-10 container mx-auto px-4 py-24">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold md:text-5xl">
          Not just Text. <span className="text-muted-foreground">Actionable Metrics.</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          Track technical debt, identify &quot;Bus Factor&quot; risks, and visualize codebase
          complexity over time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Card className="border-primary bg-landing-bg-light/50 col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Complexity vs. Documentation</CardTitle>
            <CardDescription>
              Real-time analysis of your repository health over the last 6 months.
            </CardDescription>
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
                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.slice(0, 3)}
                />

                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />

                <defs>
                  <linearGradient id="fillDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-docs)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-docs)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillComplexity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-complexity)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-complexity)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <Area
                  dataKey="docs"
                  type="natural"
                  fill="url(#fillDocs)"
                  stroke="var(--color-docs)"
                  stackId="a"
                />
                <Area
                  dataKey="complexity"
                  type="natural"
                  fill="url(#fillComplexity)"
                  stroke="var(--color-complexity)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-primary bg-landing-bg-light/50 flex flex-1 flex-col justify-center p-6">
            <div className="text-muted-foreground text-sm tracking-widest uppercase">
              Bus Factor
            </div>
            <div className="text-destructive mt-2 text-5xl font-bold">1.2</div>
            <div className="text-muted-foreground mt-2 text-xs">
              Critical Risk: module `auth/core`
            </div>
          </Card>
          <Card className="border-primary bg-landing-bg-light/50 flex flex-1 flex-col justify-center p-6">
            <div className="text-muted-foreground text-sm tracking-widest uppercase">
              Maintainability
            </div>
            <div className="text-success mt-2 text-5xl font-bold">A+</div>
            <div className="text-muted-foreground mt-2 text-xs">Improved by 15% this month</div>
          </Card>
        </div>
      </div>
    </section>
  );
}
