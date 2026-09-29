"use client";

import dynamic from "next/dynamic";

import { AnalyticsChartSkeleton } from "./analytics-chart-skeleton";

/**
 * Client boundary for the landing analytics chart.
 *
 * `AnalyticsSection` is an async server component (it awaits `getTranslations`) and
 * `next/dynamic` with `ssr: false` yields a client reference, so the dynamic call cannot
 * live there. Keeping it in this `"use client"` file moves `recharts` and its d3
 * dependency chain out of the landing route's initial payload. The chart renders static
 * demo data, so skipping SSR costs nothing.
 *
 * The skeleton is the loading placeholder precisely because its outer box is
 * `aspect-video max-h-75 w-full` — the same box the chart's `ChartContainer` occupies —
 * so the page does not shift when the chunk lands.
 */
export const LazyAnalyticsChart = dynamic(
  () => import("./analytics-chart").then((m) => m.AnalyticsChart),
  {
    loading: () => <AnalyticsChartSkeleton />,
    ssr: false,
  },
);
