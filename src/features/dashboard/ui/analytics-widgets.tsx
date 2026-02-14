"use client";

import { Status } from "@prisma/client";
import { CheckCircle2, Clock, FileCode2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { Link } from "@/i18n/routing";
import { AnalyticsWidgetsSkeleton } from "./analytics-widgets-skeleton";

export function AnalyticsWidgets() {
  const { data, isLoading } = trpc.analytics.getDashboardStats.useQuery();
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  if (isLoading || !data) {
    return <AnalyticsWidgetsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileCode2 className="text-muted-foreground h-4 w-4" />
            {t("languages_distribution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.languages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data yet</p>
            ) : (
              data.languages.map((lang) => {
                const percentage =
                  data.overview.totalLoc > 0 ? (lang.value / data.overview.totalLoc) * 100 : 0;

                return (
                  <div key={lang.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <span
                          className="block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: lang.color }}
                        />
                        <span className="font-medium">{lang.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {lang.value.toLocaleString(locale)} lines
                        {` (${percentage.toFixed(1)}%)`}
                      </span>
                    </div>

                    <Progress value={percentage} indicatorStyle={{ backgroundColor: lang.color }} />
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="text-muted-foreground h-4 w-4" />
            {t("recent_activity")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent analyses</p>
            ) : (
              data.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    {activity.status === Status.DONE && (
                      <CheckCircle2 className="text-success h-4 w-4" />
                    )}
                    {activity.status === Status.FAILED && (
                      <XCircle className="text-destructive h-4 w-4" />
                    )}
                    {(activity.status === Status.PENDING || activity.status === Status.NEW) && (
                      <Spinner className="text-warning h-4 w-4 animate-spin" />
                    )}

                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        <Link
                          className="hover:underline"
                          href={`/dashboard/repo/${activity.repoOwner}/${activity.repoName}`}
                        >
                          <span className="text-muted-foreground truncate font-bold">
                            {activity.repoOwner}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="truncate font-bold">{activity.repoName}</span>
                        </Link>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {activity.status === Status.DONE && "Analysis completed"}
                        {activity.status === Status.FAILED && "Analysis failed"}
                        {activity.status === Status.PENDING && "Analysis started"}
                        {" • "}
                        <TimeAgo date={activity.createdAt} locale={locale} />
                      </span>
                      {activity.status === Status.PENDING && (
                        <div className="mt-1 flex items-center gap-1">
                          <Progress
                            value={activity.progress}
                            className="h-1"
                            indicatorStyle={{ backgroundColor: "var(--color-warning)" }}
                          />
                          <span className="text-warning text-[10px] font-bold">
                            {activity.progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
