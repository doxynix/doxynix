"use client";
import { useLocale, useTranslations } from "next-intl";

import { ErrorState } from "@/shared/ui/kit/error-state";

import { StatCard } from "@/entities/repo/ui/stat-card";

import { getStats } from "../model/get-stats";
import { useDashboardStats } from "../model/use-dashboard-stats";
import { StatCardsSkeleton } from "./stat-cards-skeleton";

export function StatCardContainer() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  const { data, error, isError, isLoading, refetch } = useDashboardStats();

  if (isLoading) {
    return <StatCardsSkeleton />;
  }

  if (isError || data == null) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = getStats(data, t, locale);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <StatCard
          key={item.id}
          {...item}
        />
      ))}
    </div>
  );
}
