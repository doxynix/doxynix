"use client";
import { useLocale, useTranslations } from "next-intl";

import { StatCard } from "@/entities/repo/ui/stat-card";

import { getStats } from "../model/get-stats";
import { useDashboardStats } from "../model/use-dashboard-stats";
import { StatCardsSkeleton } from "./stat-cards-skeleton";

export function StatCardContainer() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  const { data, isLoading } = useDashboardStats();

  if (isLoading || data == null) {
    return <StatCardsSkeleton />;
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
