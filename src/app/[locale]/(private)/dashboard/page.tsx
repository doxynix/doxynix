import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { AnalyticsWidgets, StatCardContainer, TrendsWidget } from "@/features/dashboard";
import { CreateRepoButton, RepoListContainer } from "@/features/repo";

export const generateMetadata = createMetadata("dashboard_title", "dashboard_desc");

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="mx-auto h-full w-full space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <StatCardContainer />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{t("recent_repositories")}</h2>
            <CreateRepoButton />
          </div>

          <RepoListContainer
            config={{
              forcedFilters: {
                sortBy: "updatedAt",
                sortOrder: "desc",
              },
              limit: 5,
              showPagination: false,
              showTotalCount: false,
            }}
          />
        </div>

        <div className="lg:col-span-1">
          <AnalyticsWidgets />
        </div>
        <div className="lg:col-span-3">
          <TrendsWidget />
        </div>
      </div>
    </div>
  );
}
