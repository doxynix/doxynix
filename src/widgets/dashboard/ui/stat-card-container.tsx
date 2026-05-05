"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";

import { StatCard } from "@/entities/repo/ui/stat-card";
import { StatCardSkeleton } from "@/entities/repo/ui/stat-card-skeleton";

import { dashboardParsers } from "../model/dashboard-parsers";
import { getStats } from "../model/get-stats";

export function StatCardContainer() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  const [urlParams] = useQueryStates(dashboardParsers);

  const { data, isLoading } = trpc.analytics.getDashboardStats.useQuery({
    from: urlParams.from ?? undefined,
    period: urlParams.period ?? undefined,
    to: urlParams.to ?? undefined,
  });

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
        <StatCard key={item.id} {...item} />
      ))}
    </div>
  );
}
