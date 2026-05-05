"use client";

import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";

import { dashboardParsers } from "../model/dashboard-parsers";
import { RefactoringTargetsWidget } from "./analytics-widgets";
import { RefactoringTargetsSkeleton } from "./analytics-widgets-skeleton";

export function DashboardActionContainer() {
  const [urlParams] = useQueryStates(dashboardParsers);

  const { data, isLoading } = trpc.analytics.getDashboardStats.useQuery({
    from: urlParams.from ?? undefined,
    period: urlParams.period ?? undefined,
    to: urlParams.to ?? undefined,
  });

  if (isLoading || data == null) return <RefactoringTargetsSkeleton />;

  return <RefactoringTargetsWidget data={data} />;
}
