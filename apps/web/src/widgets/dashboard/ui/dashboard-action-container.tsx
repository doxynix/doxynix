"use client";

import { useDashboardStats } from "../model/use-dashboard-stats";
import { RefactoringTargetsWidget } from "./analytics-widgets";
import { RefactoringTargetsSkeleton } from "./analytics-widgets-skeleton";

export function DashboardActionContainer() {
  const { data, isLoading } = useDashboardStats();

  if (isLoading || data == null) {
    return <RefactoringTargetsSkeleton />;
  }

  return <RefactoringTargetsWidget data={data} />;
}
