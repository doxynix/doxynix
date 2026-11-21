"use client";

import type { ReactNode } from "react";
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
  type LucideIcon,
  Target,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";
import { Spinner } from "@/shared/ui/core/spinner";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { QualityRadar } from "@/entities/repo/ui/repo-quality-radar";

import type { DashboardStats } from "../model/dashboard.types";

type Props = { data: DashboardStats };

const TILE_TONES = {
  danger: "bg-destructive/10 text-destructive",
  default: "bg-surface-hover text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
} as const;

type WidgetTone = keyof typeof TILE_TONES;

type WidgetHeaderProps = {
  action?: ReactNode;
  icon: LucideIcon;
  title: string;
  tone?: WidgetTone;
};

function WidgetHeader({
  action,
  icon: Icon,
  title,
  tone = "default",
}: Readonly<WidgetHeaderProps>) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          TILE_TONES[tone],
        )}
      >
        <Icon />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">{title}</p>
      </div>

      {action != null && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

function WidgetEmpty({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="py-6 text-center text-muted-foreground text-sm">{children}</p>;
}

function SummaryRow({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

const STATUS_LABEL_KEYS = {
  DONE: "analysis_completed",
  FAILED: "analysis_failed",
  NEW: "analysis_started",
  PENDING: "analysis_started",
} as const;

export function EcosystemStatusWidget({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  const { docsCount, repoCount, totalLoc } = data.overview;
  const maxPossibleDocs = repoCount * 5;
  const docCoverage =
    maxPossibleDocs > 0 ? Math.min(100, Math.round((docsCount / maxPossibleDocs) * 100)) : 0;

  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeader
        action={
          repoCount > 0 ? (
            <AppBadge variant="outline">
              {docCoverage}% {t("documented")}
            </AppBadge>
          ) : undefined
        }
        icon={BookOpenCheck}
        title={t("ecosystem_status")}
      />

      {repoCount === 0 ? (
        <WidgetEmpty>{t("no_repositories_in_ecosystem")}</WidgetEmpty>
      ) : (
        <>
          <QualityRadar
            className="h-56"
            scores={data.overview.avgScores}
          />

          <div className="flex flex-col divide-y divide-border">
            <SummaryRow
              label={t("repo_repositories")}
              value={repoCount}
            />
            <SummaryRow
              label={t("sidebar_documentation")}
              value={docsCount}
            />
            <SummaryRow
              label={t("tooltip_lines")}
              value={totalLoc.toLocaleString(locale)}
            />
          </div>
        </>
      )}
    </Card>
  );
}

export function SystemRisksWidget({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const busFactorRepos = data.risks.busFactorRepos;

  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeader
        icon={AlertTriangle}
        title={t("global_risks")}
        tone={busFactorRepos > 0 ? "danger" : "default"}
      />

      {busFactorRepos === 0 ? (
        <WidgetEmpty>{t("no_data_yet")}</WidgetEmpty>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
            <p className="min-w-0 flex-1 font-medium text-sm">{t("knowledge_concentration")}</p>
            <AppBadge
              className="border-destructive/30 text-destructive"
              variant="outline"
            >
              {t("repo_needs_attention")}
            </AppBadge>
          </div>

          <p className="pl-3.5 text-muted-foreground text-xs">
            {busFactorRepos} {t("bus_factor_description")}
          </p>
        </div>
      )}
    </Card>
  );
}

export function RefactoringTargetsWidget({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");

  const hasHotspots = data.risks.topHotspots.length > 0;
  const hasCoupling = data.risks.topCoupling.length > 0;

  return (
    <Card
      className="gap-4"
      size="compact"
    >
      <WidgetHeader
        icon={Flame}
        title={t("high_impact_action_items")}
        tone={hasHotspots || hasCoupling ? "warning" : "default"}
      />

      {!hasHotspots && !hasCoupling ? (
        <WidgetEmpty>{t("no_high_impact_risks")}</WidgetEmpty>
      ) : (
        <div
          className={cn("grid grid-cols-1 gap-4", hasHotspots && hasCoupling && "md:grid-cols-2")}
        >
          {hasHotspots && (
            <section className="min-w-0">
              <p className="mb-1 text-muted-foreground text-xs">{t("refactoring_targets")}</p>

              <div className="flex flex-col divide-y divide-border">
                {data.risks.topHotspots.map((hotspot) => (
                  <div
                    className="flex items-center gap-2 py-2"
                    key={`${hotspot.repo_name}/${hotspot.path}`}
                  >
                    <Target className="size-3.5 shrink-0 text-muted-foreground" />

                    <span className="min-w-0 flex-1 truncate text-xs">
                      <span className="text-muted-foreground">{hotspot.repo_name}/</span>
                      <span className="font-medium text-foreground">
                        {hotspot.path.split("/").pop()}
                      </span>
                    </span>

                    <AppBadge
                      className="border-destructive/30 text-destructive"
                      variant="outline"
                    >
                      {t("points", { count: hotspot.score })}
                    </AppBadge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasCoupling && (
            <section className="min-w-0">
              <p className="mb-1 text-muted-foreground text-xs">{t("hidden_dependencies")}</p>

              <div className="flex flex-col divide-y divide-border">
                {data.risks.topCoupling.map((coupling) => (
                  <div
                    className="flex items-center gap-2 py-2 text-xs"
                    key={`${coupling.repo_name}:${coupling.from_path}->${coupling.to_path}`}
                  >
                    <GitMerge className="size-3.5 shrink-0 text-muted-foreground" />

                    <span className="min-w-0 flex-1 truncate">
                      {coupling.from_path.split("/").pop()}
                    </span>

                    <ArrowLeftRight className="size-3 shrink-0 text-muted-foreground" />

                    <span className="min-w-0 flex-1 truncate">
                      {coupling.to_path.split("/").pop()}
                    </span>

                    <span className="shrink-0 text-muted-foreground">
                      {coupling.commits} {t("commits")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}

export function HealthExtremesWidget({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const { mostCritical, topPerformer } = data.highlights;

  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeader
        icon={HeartPulse}
        title={t("health_extremes")}
      />

      {topPerformer == null && mostCritical == null ? (
        <WidgetEmpty>{t("no_extremes")}</WidgetEmpty>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {topPerformer != null && (
            <div className="flex items-center gap-2.5 py-2.5">
              <span className="size-1.5 shrink-0 rounded-full bg-success" />
              <span className="min-w-0 flex-1 truncate text-sm">{topPerformer.name}</span>
              <span className="font-semibold text-sm text-success">{topPerformer.score}</span>
            </div>
          )}

          {mostCritical != null && (
            <div className="flex items-center gap-2.5 py-2.5">
              <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
              <span className="min-w-0 flex-1 truncate text-sm">{mostCritical.name}</span>
              <span className="font-semibold text-destructive text-sm">{mostCritical.score}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function LanguagesWidget({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const totalLoc = data.overview.totalLoc;

  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeader
        action={
          <span className="text-muted-foreground text-xs">
            {totalLoc.toLocaleString(locale)} {t("lines")}
          </span>
        }
        icon={FileCode2}
        title={t("languages_distribution")}
      />

      {data.languages.length === 0 ? (
        <WidgetEmpty>{t("no_data_yet")}</WidgetEmpty>
      ) : (
        <>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {data.languages.map((language) => {
              const percentage = totalLoc > 0 ? (language.value / totalLoc) * 100 : 0;

              return (
                <div
                  key={language.name}
                  style={{
                    backgroundColor: language.color,
                    width: `${percentage}%`,
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-col divide-y divide-border">
            {data.languages.map((language) => {
              const percentage = totalLoc > 0 ? (language.value / totalLoc) * 100 : 0;

              return (
                <div
                  className="flex items-center gap-2 py-2 text-xs"
                  key={language.name}
                >
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: language.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{language.name}</span>
                  <span className="shrink-0 text-muted-foreground">{Math.round(percentage)}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

export function RecentActivityWidget({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  return (
    <Card
      className="gap-3"
      size="compact"
    >
      <WidgetHeader
        icon={Clock}
        title={t("recent_activity")}
      />

      {data.recentActivity.length === 0 ? (
        <WidgetEmpty>{t("no_recent_analyses")}</WidgetEmpty>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {data.recentActivity.map((activity) => (
            <div
              className="flex items-start gap-2.5 py-2.5"
              key={activity.id}
            >
              <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {activity.status === "DONE" && <CheckCircle2 className="text-success" />}
                {activity.status === "FAILED" && <XCircle className="text-destructive" />}
                {activity.status === "PENDING" && <Spinner className="text-warning" />}
                {activity.status === "NEW" && <CircleDot className="text-muted-foreground" />}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  className="block truncate font-medium text-sm hover:underline"
                  href={`/dashboard/repo/${activity.repoOwner}/${activity.repoName}`}
                >
                  <span className="text-muted-foreground">{activity.repoOwner}</span>
                  <span className="text-muted-foreground">/</span>
                  <span>{activity.repoName}</span>
                </Link>

                <p className="mt-0.5 text-muted-foreground text-xs">
                  {t(STATUS_LABEL_KEYS[activity.status])}
                  {" · "}
                  <TimeAgo
                    date={activity.createdAt}
                    locale={locale}
                  />
                </p>

                {activity.status === "PENDING" && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress
                      className="h-1 flex-1"
                      indicatorStyle={{ backgroundColor: "var(--status-warning)" }}
                      value={activity.progress}
                    />
                    <span className="text-warning text-xs">{activity.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
