"use client";

import { ErrorState } from "@/shared/ui/kit/error-state";

import { useDashboardStats } from "../model/use-dashboard-stats";
import { RefactoringTargetsWidget } from "./analytics-widgets";
import { RefactoringTargetsSkeleton } from "./analytics-widgets-skeleton";

export function DashboardActionContainer() {
  const { data, error, isError, isLoading, refetch } = useDashboardStats();

  if (isLoading) {
    return <RefactoringTargetsSkeleton />;
  }

  if (isError || data == null) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return <RefactoringTargetsWidget data={data} />;
}
