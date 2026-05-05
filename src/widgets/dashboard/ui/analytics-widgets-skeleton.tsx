"use client";

import { AlertTriangle, BookOpenCheck, Clock, FileCode2, Flame, HeartPulse } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function LanguagesSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileCode2 className="text-muted-foreground" />
          {t("languages_distribution")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthExtremesSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HeartPulse className="text-muted-foreground" />
          Health Extremes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="border-border flex items-center justify-between rounded-xl border p-2"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-8 rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function EcosystemStatusSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpenCheck className="text-muted-foreground" />
            Ecosystem Status
          </span>
          <Skeleton className="h-6 w-24 rounded-full" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pt-4">
        <div className="relative flex size-75 items-center justify-center">
          <div className="border-accent/20 absolute size-full rounded-full border border-dashed" />
          <div className="border-accent/20 absolute size-2/3 rounded-full border border-dashed" />
          <div className="border-accent/20 absolute size-1/3 rounded-full border border-dashed" />
          <Skeleton className="size-40 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RefactoringTargetsSkeleton() {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flame className="text-destructive" />
          High-Impact Action Items
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div key={idx} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border flex items-center justify-between rounded-xl border p-2"
                >
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-4 w-10 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RecentActivitySkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="text-muted-foreground" />
          {t("recent_activity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="flex flex-1 items-center gap-3">
                <Skeleton className="size-5 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TrendsWidgetsSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle className="text-xl">{t("trends_title")}</CardTitle>
          <CardDescription>{t("trends_desc")}</CardDescription>
        </div>
        <div className="flex items-center px-6 py-4 sm:py-0">
          <Skeleton className="h-9 w-42 rounded-lg" />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative h-75 w-full">
          <div className="absolute inset-0 flex flex-col justify-between py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-3 w-8" />
                <div className="bg-border h-px flex-1" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 left-12 flex items-end">
            <Skeleton className="h-1/2 w-full rounded-t-3xl" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemRisksSkeleton() {
  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-destructive/50 flex items-center gap-2 text-sm">
          <AlertTriangle />
          Global Risks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-44" />
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
