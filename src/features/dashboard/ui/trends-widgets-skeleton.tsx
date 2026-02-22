"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function TrendsWidgetsSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle className="text-xl">{t("trends_title")}</CardTitle>
          <CardDescription>{t("trends_desc")}</CardDescription>
        </div>
        <div className="flex items-center px-6 py-4 sm:py-0">
          <Skeleton className="h-9 w-42" />
        </div>
      </CardHeader>

      <CardContent className="px-6 pt-6">
        <div className="relative h-75">
          <div className="absolute top-0 left-0 flex h-full w-8 flex-col justify-between py-2 text-[10px]">
            {[100, 75, 50, 25, 0].map((v) => (
              <Skeleton key={v} className="h-3 w-6" />
            ))}
          </div>

          <div className="ml-10 h-full overflow-hidden">
            <svg
              preserveAspectRatio="none"
              viewBox="0 0 400 100"
              className="h-full w-full animate-pulse"
            >
              <path
                d="M0 20 Q 100 15, 200 25 T 400 30 L 400 100 L 0 100 Z"
                fill="currentColor"
                className="text-primary/10"
              />
              <path
                d="M0 50 Q 100 45, 200 55 T 400 50 L 400 100 L 0 100 Z"
                fill="currentColor"
                className="text-primary/20"
              />

              <line
                stroke="currentColor"
                strokeWidth="0.5"
                x1="0"
                x2="400"
                y1="25"
                y2="25"
                className="text-muted/20"
              />
              <line
                stroke="currentColor"
                strokeWidth="0.5"
                x1="0"
                x2="400"
                y1="50"
                y2="50"
                className="text-muted/20"
              />
              <line
                stroke="currentColor"
                strokeWidth="0.5"
                x1="0"
                x2="400"
                y1="75"
                y2="75"
                className="text-muted/20"
              />
            </svg>
          </div>

          <div className="mt-2 ml-10 flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
