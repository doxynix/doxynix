import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import type { PageProps } from "@/shared/lib/next.types";
import { urlStateFromSearchParams } from "@/shared/lib/url-state";

import { CreateRepoButton } from "@/features/repo/ui/create-repo-button";
import { RepoListContainer } from "@/features/repo/ui/repo-list-container";
import {
  dashboardParsers,
  dashboardRangeInput,
} from "@/features/repo-analytics/model/dashboard-parsers";
import { TrendsWidget } from "@/features/repo-analytics/ui/repo-trends-widget";

import { DashboardActionContainer } from "@/widgets/dashboard/ui/dashboard-action-container";
import { DashboardDatePeriod } from "@/widgets/dashboard/ui/dashboard-date-range";
import { DashboardInsightsContainer } from "@/widgets/dashboard/ui/dashboard-insights-container";
import { GettingStartedChecklist } from "@/widgets/dashboard/ui/getting-started-checklist";
import { StatCardContainer } from "@/widgets/dashboard/ui/stat-card-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("dashboard_title", "dashboard_desc");

export default async function DashboardPage({ searchParams }: Readonly<PageProps>) {
  const t = await getTranslations("Dashboard");

  const range = dashboardRangeInput(urlStateFromSearchParams(dashboardParsers, await searchParams));

  await Promise.all([
    prefetch(trpcProxy.analytics.getDashboardStats.queryOptions(range)),
    prefetch(trpcProxy.analytics.getTrends.queryOptions({ ...range, repoId: undefined })),
    prefetch(trpcProxy.user.getOnboardingState.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <div className="mx-auto flex h-full w-full flex-col gap-8">
        <div className="sticky top-0 right-0 flex h-0 justify-end overflow-visible pt-2">
          <DashboardDatePeriod />
        </div>

        <div className="flex flex-col gap-4">
          <GettingStartedChecklist />
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-2xl">{t("title")}</h1>
          </div>
          <StatCardContainer />
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-8">
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg">{t("recent_repositories")}</h2>
                <CreateRepoButton />
              </div>
              <RepoListContainer
                config={{ limit: 5, showPagination: false, showTotalCount: false }}
              />
            </section>

            <DashboardActionContainer />

            <TrendsWidget />
          </div>
          <DashboardInsightsContainer />
        </div>
      </div>
    </HydrateClient>
  );
}
