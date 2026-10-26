"use client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoAnalyzeButton } from "@/entities/repo/ui/repo-analyze-button";

import { RepoOverview } from "./repo-overview";

type Props = { repoId: string };

export function RepoOverviewContainer({ repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { aid, name, owner } = useRepoParams();
  const { data, isLoading } = useQuery(
    trpc.analysis.getWorkspace.queryOptions({
      aid: aid ?? undefined,
      repoId,
    }),
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-2 px-6 pb-2">
            <SkeletonText
              lines={1}
              size="xxl"
              widths={["w-56"]}
            />
          </div>
          <div className="flex flex-col gap-4 px-6">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-full"]}
            />
            <div className="flex flex-wrap gap-2">
              <SkeletonText
                lines={1}
                widths={["w-24"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-24"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-24"]}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <div className="px-6">
              <Skeleton className="h-9 w-full" />
            </div>
          </Card>
          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <div className="flex flex-col gap-4 px-6">
              <SkeletonText
                lines={1}
                widths={["w-24"]}
              />
              <Skeleton className="h-8 w-full" />
              <SkeletonText
                lines={1}
                widths={["w-24"]}
              />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SkeletonList
            className="contents"
            count={5}
            renderItem={() => (
              <Card>
                <div className="flex flex-row items-center justify-between px-6 pb-2">
                  <SkeletonText
                    lines={1}
                    size="lg"
                    widths={["w-24"]}
                  />
                  <Skeleton className="size-8 rounded-full" />
                </div>
                <div className="flex flex-col gap-1 px-6">
                  <Skeleton className="h-8 w-20" />
                  <SkeletonText
                    lines={1}
                    widths={["w-28"]}
                  />
                </div>
              </Card>
            )}
          />

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 px-6">
              <SkeletonText
                lines={1}
                widths={["w-32"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-32"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-48"]}
              />
            </div>
          </Card>

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-full"]}
              />
            </div>
          </Card>

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <SkeletonText
              className="px-6"
              lines={2}
              widths={["w-full", "w-full"]}
            />
          </Card>

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-32"]}
              />
            </div>
            <div className="flex flex-col gap-3 px-6">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </Card>

          <Card>
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <div className="px-6">
              <Skeleton className="h-40 w-full rounded-full" />
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-40"]}
              />
            </div>
            <SkeletonText
              className="px-6"
              lines={2}
              widths={["w-full", "w-full"]}
            />
          </Card>

          <Card className="lg:col-span-2">
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-32"]}
              />
            </div>
            <div className="flex flex-col gap-3 px-6">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </Card>

          <Card className="col-span-4">
            <div className="px-6">
              <SkeletonText
                lines={1}
                size="xxl"
                widths={["w-40"]}
              />
            </div>
            <div className="px-6">
              <Skeleton className="h-75 w-full" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (data == null) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={
            <RepoAnalyzeButton
              name={name}
              owner={owner}
            />
          }
          description={t("repo_overview_empty_desc")}
          icon={BarChart3}
          title={t("repo_overview_empty_title")}
        />
      </div>
    );
  }

  return <RepoOverview data={data} />;
}
