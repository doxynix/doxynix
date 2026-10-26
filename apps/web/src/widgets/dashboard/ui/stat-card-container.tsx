"use client";
import { useLocale, useTranslations } from "next-intl";

import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import { StatCard } from "@/entities/repo/ui/stat-card";
import { StatCardSkeleton } from "@/entities/repo/ui/stat-card-skeleton";

import { getStats } from "../model/get-stats";
import { useDashboardStats } from "../model/use-dashboard-stats";

export function StatCardContainer() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  const { data, isLoading } = useDashboardStats();

  if (isLoading || data == null) {
    return (
      <SkeletonList
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        count={8}
        renderItem={() => <StatCardSkeleton />}
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
