"use client";

import { Clock, FileCode2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function AnalyticsWidgetsSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileCode2 className="text-muted-foreground h-4 w-4" />
            {t("languages_distribution")}
          </CardTitle>
        </CardHeader>
        {Array.from({ length: 4 }).map((_, j) => (
          <CardContent key={j}>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-2.5 w-2.5" />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                  <Skeleton className="h-2.5 w-25"></Skeleton>
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          </CardContent>
        ))}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="text-muted-foreground h-4 w-4" />
            {t("recent_activity")}
          </CardTitle>
        </CardHeader>
        {Array.from({ length: 5 }).map((_, j) => (
          <CardContent key={j}>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-50" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        ))}
      </Card>
    </div>
  );
}
