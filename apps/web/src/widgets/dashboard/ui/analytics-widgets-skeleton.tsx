"use client";

import { AlertTriangle, BookOpenCheck, Clock, FileCode2, Flame, HeartPulse } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

const LANGUAGE_FILLS = ["w-3/5", "w-2/5", "w-4/5", "w-1/2"];

export function LanguagesSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-base">
          <FileCode2 className="text-muted-foreground" />
          {t("languages_distribution")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SkeletonList
          className="flex flex-col gap-4"
          count={4}
          itemClassName="flex flex-col gap-1"
          renderItem={(index) => (
            <>
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1">
                  <Skeleton className="size-2.5 rounded-full" />
                  <SkeletonText
                    lines={1}
                    size="sm"
                    widths={["w-12"]}
                  />
                </div>
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-8"]}
                />
              </div>

              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <Skeleton
                  className={`absolute inset-y-0 left-0 rounded-full ${LANGUAGE_FILLS[index % LANGUAGE_FILLS.length]}`}
                />
              </div>
            </>
          )}
        />
      </CardContent>
    </Card>
  );
}

export function HealthExtremesSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HeartPulse className="text-muted-foreground" />
          {t("health_extremes")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <SkeletonList
          className="flex flex-col gap-2"
          count={2}
          itemClassName="flex items-center justify-between rounded-xl border border-border p-2"
          renderItem={() => (
            <>
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <SkeletonText
                  lines={1}
                  widths={["w-28"]}
                />
              </div>
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-8"]}
              />
            </>
          )}
        />
      </CardContent>
    </Card>
  );
}

export function EcosystemStatusSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpenCheck className="text-muted-foreground" />
            {t("ecosystem_status")}
          </span>
          <SkeletonText
            lines={1}
            widths={["w-24"]}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pt-4">
        <div className="relative flex size-75 items-center justify-center">
          <div className="absolute size-full rounded-full border border-accent/20 border-dashed" />
          <div className="absolute size-2/3 rounded-full border border-accent/20 border-dashed" />
          <div className="absolute size-1/3 rounded-full border border-accent/20 border-dashed" />
          <Skeleton className="size-24 rotate-45 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RefactoringTargetsSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flame className="text-destructive" />
          {t("high_impact_action_items")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6" />
            <SkeletonText
              lines={1}
              widths={["w-32"]}
            />
          </div>
          <SkeletonList
            className="flex flex-col gap-2"
            count={3}
            itemClassName="flex items-center justify-between rounded-xl border border-border p-2"
            renderItem={() => (
              <>
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-40"]}
                />
                <Skeleton className="h-5 w-10" />
              </>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6" />
            <SkeletonText
              lines={1}
              widths={["w-32"]}
            />
          </div>
          <SkeletonList
            className="flex flex-col gap-2"
            count={3}
            itemClassName="flex items-center gap-2 rounded-xl border border-border p-2"
            renderItem={() => (
              <>
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-16"]}
                />
                <Skeleton className="size-6" />
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-16"]}
                />
              </>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentActivitySkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-base">
          <Clock className="text-muted-foreground" />
          {t("recent_activity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SkeletonList
          className="flex flex-col gap-4"
          count={5}
          itemClassName="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
          renderItem={() => (
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex flex-1 flex-col">
                <SkeletonText
                  lines={1}
                  widths={["w-3/4"]}
                />
                <SkeletonText
                  lines={1}
                  size="sm"
                  widths={["w-1/2"]}
                />
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

export function SystemRisksSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-destructive/50 text-sm">
          <AlertTriangle />
          {t("global_risks")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded" />
          <div className="flex flex-1 flex-col">
            <SkeletonText
              lines={1}
              widths={["w-44"]}
            />
            <SkeletonText
              className="mt-1"
              lines={1}
              size="sm"
              widths={["w-40"]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
