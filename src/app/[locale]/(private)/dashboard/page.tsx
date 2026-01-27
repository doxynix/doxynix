import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { CreateRepoButton, RepoListContainer, StatCard } from "@/features/repo";

export const generateMetadata = createMetadata("dashboard_title", "dashboard_desc");

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="mx-auto h-full w-full">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <StatCard />
      </div>
      <div className="xs:justify-between mb-4 flex flex-wrap items-center justify-center gap-3">
        <p className="xs:order-0 xs:text-base order-1 text-sm">{t("recent_repositories")}</p>
        <CreateRepoButton />
      </div>
      <RepoListContainer
        config={{
          limit: 4,
          showPagination: false,
          showTotalCount: false,
          forcedFilters: {
            sortBy: "updatedAt",
            sortOrder: "desc",
          },
        }}
      />
    </div>
  );
}
