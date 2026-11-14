import { Suspense } from "react";
import { MAX_PAGE } from "@doxynix/shared";
import { getTranslations } from "next-intl/server";
import { createLoader } from "nuqs/server";

import type { RouterInput } from "@/shared/api/trpc";
import { createMetadata } from "@/shared/lib/metadata";
import type { PageProps } from "@/shared/lib/next.types";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { urlStateFromSearchParams } from "@/shared/lib/url-state";

import { repoParsers } from "@/entities/repo/model/repo-parsers";

import { CreateRepoButton } from "@/features/repo/ui/create-repo-button";
import { RepoListContainer } from "@/features/repo/ui/repo-list-container";
import { RepoListSkeleton } from "@/features/repo/ui/repo-list-skeleton";
import {
  dashboardParsers,
  dashboardRangeInput,
} from "@/features/repo-analytics/model/dashboard-parsers";
import { TrendsWidget } from "@/features/repo-analytics/ui/repo-trends-widget";
import { TrendsWidgetsSkeleton } from "@/features/repo-analytics/ui/repo-trends-widget-skeleton";

import { DashboardActionContainer } from "@/widgets/dashboard/ui/dashboard-action-container";
import { DashboardDatePeriod } from "@/widgets/dashboard/ui/dashboard-date-range";
import { DashboardInsightsContainer } from "@/widgets/dashboard/ui/dashboard-insights-container";
import { DashboardInsightsSkeleton } from "@/widgets/dashboard/ui/dashboard-insights-skeleton";
import { GettingStartedChecklist } from "@/widgets/dashboard/ui/getting-started-checklist";
import { StatCardContainer } from "@/widgets/dashboard/ui/stat-card-container";
import { StatCardsSkeleton } from "@/widgets/dashboard/ui/stat-cards-skeleton";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("dashboard_title", "dashboard_desc");

const DASHBOARD_REPO_LIMIT = 5;

type Range = ReturnType<typeof dashboardRangeInput>;
type RepoQuery = RouterInput["repo"]["getAll"];

const loadRepoParams = createLoader(repoParsers);

export default async function DashboardPage({ searchParams }: Readonly<PageProps>) {
  const t = await getTranslations("Dashboard");
  const query = await searchParams;

  const range = dashboardRangeInput(urlStateFromSearchParams(dashboardParsers, query));
  const repoState = loadRepoParams(query);

  const repoQuery: RepoQuery = {
    from: repoState.from ?? undefined,
    limit: DASHBOARD_REPO_LIMIT,
    page: clampIntegerParam(repoState.page, { fallback: 1, max: MAX_PAGE, min: 1 }),
    search: repoState.search || undefined,
    sortBy: repoState.sortBy,
    status: repoState.status ?? undefined,
    to: repoState.to ?? undefined,
    visibility: repoState.visibility ?? undefined,
  };

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-8">
      <div className="sticky top-0 right-0 flex h-0 justify-end overflow-visible pt-2">
        <DashboardDatePeriod />
      </div>

      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <ChecklistSection />
        </Suspense>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl">{t("title")}</h1>
        </div>
        <Suspense fallback={<StatCardsSkeleton />}>
          <StatsSection range={range} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">{t("recent_repositories")}</h2>
              <CreateRepoButton />
            </div>
            <Suspense
              fallback={
                <RepoListSkeleton
                  count={DASHBOARD_REPO_LIMIT}
                  showTotalCount={false}
                />
              }
            >
              <RepoListSection query={repoQuery} />
            </Suspense>
          </section>

          <DashboardActionContainer />

          <Suspense fallback={<TrendsWidgetsSkeleton />}>
            <TrendsSection range={range} />
          </Suspense>
        </div>
        <Suspense fallback={<DashboardInsightsSkeleton />}>
          <InsightsSection range={range} />
        </Suspense>
      </div>
    </div>
  );
}

async function ChecklistSection() {
  await prefetch(trpcProxy.user.getOnboardingState.queryOptions());

  return (
    <HydrateClient>
      <GettingStartedChecklist />
    </HydrateClient>
  );
}

async function StatsSection({ range }: Readonly<{ range: Range }>) {
  await prefetch(trpcProxy.analytics.getDashboardStats.queryOptions(range));

  return (
    <HydrateClient>
      <StatCardContainer />
    </HydrateClient>
  );
}

async function InsightsSection({ range }: Readonly<{ range: Range }>) {
  await prefetch(trpcProxy.analytics.getDashboardStats.queryOptions(range));

  return (
    <HydrateClient>
      <DashboardInsightsContainer />
    </HydrateClient>
  );
}

async function TrendsSection({ range }: Readonly<{ range: Range }>) {
  await prefetch(trpcProxy.analytics.getTrends.queryOptions({ ...range, repoId: undefined }));

  return (
    <HydrateClient>
      <TrendsWidget />
    </HydrateClient>
  );
}

async function RepoListSection({ query }: Readonly<{ query: RepoQuery }>) {
  await prefetch(trpcProxy.repo.getAll.queryOptions(query));

  return (
    <HydrateClient>
      <RepoListContainer
        config={{
          limit: DASHBOARD_REPO_LIMIT,
          showPagination: false,
          showTotalCount: false,
        }}
      />
    </HydrateClient>
  );
}
