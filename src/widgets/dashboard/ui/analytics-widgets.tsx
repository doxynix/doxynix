"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDot,
  Clock,
  FileCode2,
  Flame,
  GitMerge,
  HeartPulse,
  Target,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/core/chart";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";
import { TimeAgo } from "@/shared/ui/kit/time-ago";
import { Link } from "@/i18n/routing";

import type { DashboardStats } from "../model/dashboard.types";

type Props = { data: DashboardStats };

export function EcosystemStatusWidget({ data }: Readonly<Props>) {
  const repoCount = data.overview.repoCount;
  const docsCount = data.overview.docsCount;
  const maxPossibleDocs = data.overview.repoCount * 5;
  const docCoverage =
    maxPossibleDocs > 0 ? Math.min(100, Math.round((docsCount / maxPossibleDocs) * 100)) : 0;

  const isEmpty = repoCount === 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpenCheck />
            Ecosystem Status
          </span>
          {isEmpty === false && (
            <Badge variant="outline" className="font-mono">
              {docCoverage}% Documented
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isEmpty === true ? (
          <div className="flex h-62.5 flex-col items-center justify-center gap-2 rounded-xl border">
            <p className="text-muted-foreground text-sm">No repositories found in ecosystem</p>
          </div>
        ) : (
          <QualityRadar scores={data.overview.avgScores} />
        )}
      </CardContent>
    </Card>
  );
}

export function SystemRisksWidget({ data }: Readonly<Props>) {
  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-destructive flex items-center gap-2 text-sm">
          <AlertTriangle /> Global Risks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.risks.busFactorRepos === 0 ? (
          <p className="text-muted-foreground text-sm">No data yet</p>
        ) : (
          <div className="flex gap-3 text-sm">
            <Users />
            <div className="space-y-1">
              <p>Knowledge Concentration</p>
              <p className="text-muted-foreground mt-1 text-xs">
                <span className="text-destructive font-bold">{data.risks.busFactorRepos}</span>{" "}
                repositories have a Bus Factor of 1. If the key maintainer leaves, the code becomes
                legacy.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RefactoringTargetsWidget({ data }: Readonly<Props>) {
  const hasHotspots = data.risks.topHotspots.length > 0;
  const hasCoupling = data.risks.topCoupling.length > 0;
  const isEmpty = !hasHotspots && !hasCoupling;

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flame className="text-destructive" /> High-Impact Action Items
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("grid grid-cols-1 gap-6 pt-4", !isEmpty && "md:grid-cols-2")}>
        {isEmpty ? (
          <div className="col-span-full py-10 text-center">
            <p className="text-muted-foreground text-sm">
              No high-impact risks identified in current scope
            </p>
          </div>
        ) : (
          <>
            {hasHotspots && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Target /> Refactoring Targets
                </p>
                {data.risks.topHotspots.map((h, i) => (
                  <div
                    key={i}
                    className="border-border flex items-center justify-between rounded-xl border p-2 text-xs"
                  >
                    <span className="text-muted-foreground max-w-50 truncate">
                      {h.repo_name}/
                      <span className="text-foreground font-bold">{h.path.split("/").pop()}</span>
                    </span>
                    <Badge variant="destructive" className="h-5 text-[10px]">
                      {h.score} pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {hasCoupling && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <GitMerge /> Hidden Dependencies (Change Coupling)
                </p>
                {data.risks.topCoupling.map((c, i) => (
                  <div
                    key={i}
                    className="border-border flex items-center gap-2 rounded-xl border p-2 text-xs"
                  >
                    <span className="truncate">{c.from_path.split("/").pop()}</span>
                    <ArrowLeftRight />
                    <span className="truncate">{c.to_path.split("/").pop()}</span>
                    <span className="text-muted-foreground ml-auto">
                      {c.commits} <span>commits</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function HealthExtremesWidget({ data }: Readonly<Props>) {
  const hasData = !!(data.highlights.topPerformer || data.highlights.mostCritical);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HeartPulse /> Health Extremes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!hasData ? (
          <p className="text-muted-foreground text-sm">No extremes detected for this period</p>
        ) : (
          <>
            {data.highlights.topPerformer && (
              <div className="border-success/20 flex items-center justify-between rounded-xl border p-2">
                <div className="flex items-center gap-2">
                  <Trophy className="text-success" />
                  <span className="text-sm font-medium">{data.highlights.topPerformer.name}</span>
                </div>
                <span className="text-success font-bold">{data.highlights.topPerformer.score}</span>
              </div>
            )}
            {data.highlights.mostCritical && (
              <div className="border-destructive/20 flex items-center justify-between rounded-xl border p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-destructive" />
                  <span className="text-sm font-medium">{data.highlights.mostCritical.name}</span>
                </div>
                <span className="text-destructive font-bold">
                  {data.highlights.mostCritical.score}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function LanguagesWidget({ data }: Readonly<Props>) {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileCode2 />
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

                  <Progress
                    value={percentage}
                    indicatorStyle={{ backgroundColor: lang.color }}
                    aria-label={`Usage of ${lang.name} language`}
                  />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentActivityWidget({ data }: Readonly<Props>) {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <Clock />
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
                <div className="flex min-w-0 items-center gap-3">
                  {activity.status === "DONE" && <CheckCircle2 className="text-success" />}
                  {activity.status === "FAILED" && <XCircle className="text-destructive" />}
                  {activity.status === "PENDING" && <Spinner className="text-warning" />}
                  {activity.status === "NEW" && <CircleDot />}

                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/dashboard/repo/${activity.repoOwner}/${activity.repoName}`}
                      className="block w-full truncate text-sm font-medium hover:underline"
                    >
                      <span className="text-muted-foreground truncate font-bold">
                        {activity.repoOwner}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="truncate font-bold">{activity.repoName}</span>
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {activity.status === "DONE" && "Analysis completed"}
                      {activity.status === "FAILED" && "Analysis failed"}
                      {activity.status === "PENDING" && "Analysis started"}
                      {" • "}
                      <TimeAgo date={activity.createdAt} locale={locale} />
                    </span>
                    {activity.status === "PENDING" && (
                      <div className="mt-1 flex items-center gap-1">
                        <Progress
                          value={activity.progress}
                          indicatorStyle={{ backgroundColor: "var(--status-warning)" }}
                          className="h-1 flex-1"
                        />
                        <span className="text-warning text-xs font-bold">{activity.progress}%</span>
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
  );
}

type QualityRadarProps = {
  scores: {
    complexity: number;
    health: number;
    onboarding: number;
    security: number;
    techDebt: number;
  };
};

export function QualityRadar({ scores }: Readonly<QualityRadarProps>) {
  const chartData = [
    { fullMark: 100, subject: "Health", value: scores.health },
    { fullMark: 100, subject: "Security", value: scores.security },
    { fullMark: 100, subject: "Simplicity", value: 100 - scores.complexity },
    { fullMark: 100, subject: "Onboarding", value: scores.onboarding },
    { fullMark: 100, subject: "Maintainability", value: 100 - scores.techDebt },
  ];

  const config = {
    value: { color: "var(--chart-1)", label: "Score" },
  };

  return (
    <ChartContainer config={config} className="h-75 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <RadarChart cx="50%" cy="50%" data={chartData} outerRadius="80%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
          />
          <Radar
            name="Quality"
            dataKey="value"
            fill="var(--foreground)"
            fillOpacity={0.3}
            stroke="var(--background)"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
