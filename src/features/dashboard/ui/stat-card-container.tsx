"use client";

import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";

import { getStats, StatCard, StatCardSkeleton } from "@/entities/repo-details";

export function StatCardContainer() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  const { data, isLoading } = trpc.analytics.getDashboardStats.useQuery();

  if (isLoading || !data) {
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
        <StatCard key={item.id} {...item} />
      ))}
    </div>
  );
}
