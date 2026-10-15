"use client";
import { useLocale, useTranslations } from "next-intl";

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
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
