"use client";

import dynamic from "next/dynamic";

import { AnalyticsChartSkeleton } from "./analytics-chart-skeleton";

export const LazyAnalyticsChart = dynamic(
  () => import("./analytics-chart").then((m) => m.AnalyticsChart),
  {
    loading: () => <AnalyticsChartSkeleton />,
    ssr: false,
  },
);
