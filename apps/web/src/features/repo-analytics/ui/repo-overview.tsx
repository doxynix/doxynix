"use client";

import type { ComponentProps } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Book,
  BookOpenCheck,
  Code2,
  FileIcon,
  FileText,
  HeartPulse,
  Layers,
  Map,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { StatusBadge } from "@/shared/ui/kit/status-badge";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { getGitMetrics } from "@/entities/repo/model/git-metrics";
import type { RepoWorkspace } from "@/entities/repo/model/repo.types";
import {
  buildRepoDocsHref,
  buildRepoMapHref,
  buildRepoSearchResultHref,
} from "@/entities/repo/model/repo-workspace-navigation";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoGitMetric } from "@/entities/repo/ui/repo-git-metric";
import { RepoTopics } from "@/entities/repo/ui/repo-topics";
import { StatCard } from "@/entities/repo/ui/stat-card";

import { TrendsWidget } from "./repo-trends-widget";
import { RepoWorkspaceSearch } from "./repo-workspace-search";

type Props = { data: NonNullable<RepoWorkspace> };

type Signals = Props["data"]["secondary"]["signals"];

type DocLabelKey =
  | "repo_docs_api_reference"
  | "repo_docs_architecture"
  | "repo_docs_file_audits"
  | "repo_docs_history"
  | "repo_docs_how_to_guides"
  | "repo_docs_overview";

const DOC_LABEL_KEYS: Record<string, DocLabelKey> = {
  API: "repo_docs_api_reference",
  ARCHITECTURE: "repo_docs_architecture",
  CHANGELOG: "repo_docs_history",
  CODE_DOC: "repo_docs_file_audits",
  CONTRIBUTING: "repo_docs_how_to_guides",
  README: "repo_docs_overview",
};

export function RepoOverview({ data }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { aid, name, owner } = useRepoParams();

  const gitMetrics = getGitMetrics(data.repo, locale);

  const { docs, navigation, repo, secondary, summary, topRisks } = data;
  const maintenanceTone =
    summary.maintenance === "active"
      ? "success"
      : summary.maintenance === "stale"
        ? "warning"
        : "danger";

  const health = secondary.scores.health;
  const security = secondary.scores.security;
  const techDebt = secondary.scores.techDebt;
  const onboarding = secondary.scores.onboarding;
  const complexity = secondary.scores.complexity;

  const handleMapNodeNavigation = (nodeId: string) => {
    router.push(
      buildRepoSearchResultHref({
        aid,
        name,
        owner,
        result: {
          description: t("key_zones"),
          docSectionId: null,
          docType: null,
          id: `node:${nodeId}`,
          kind: "node",
          label: nodeId,
          nodeId,
          path: null,
          score: 0,
          targetView: "map",
        },
      }),
    );
  };

  const handleCodeNavigation = (path: string) => {
    router.push(
      buildRepoSearchResultHref({
        aid,
        name,
        owner,
        result: {
          description: t("entrypoints"),
          docSectionId: null,
          docType: null,
          id: `file:${path}`,
          kind: "file",
          label: path.split("/").pop() ?? path,
          nodeId: `file:${path}`,
          path,
          score: 0,
          targetView: "code",
        },
      }),
    );
  };

  const REPO_STATS_CARDS: ReadonlyArray<ComponentProps<typeof StatCard> & { id: string }> = [
    {
      className: health > 75 ? "bg-success/10" : "bg-warning/10",
      description: health > 75 ? t("health_desc_stable") : t("health_desc_maintenance"),
      icon: Activity,
      iconClass: health > 75 ? "text-success" : "text-warning",
      id: "health",
      label: t("health_score"),
      meter: health,
      tone: health > 75 ? "success" : "warning",
      value: `${health}/100`,
    },
    {
      className: security > 80 ? "bg-success/10" : "bg-warning/10",
      description: security > 80 ? t("security_desc_safe") : t("security_desc_check"),
      icon: ShieldCheck,
      iconClass: security > 80 ? "text-success" : "text-warning",
      id: "security",
      label: t("security_score"),
      meter: security,
      tone: security > 80 ? "success" : "warning",
      value: `${security}/100`,
    },
    {
      className: complexity > 60 ? "bg-destructive/10" : "bg-warning/10",
      description: complexity > 60 ? t("complexity_desc_high") : t("complexity_desc_manageable"),
      icon: Layers,
      iconClass: complexity > 60 ? "text-destructive" : "text-warning",
      id: "complexity",
      label: t("complexity_label"),
      meter: complexity,
      tone: complexity > 60 ? "danger" : "warning",
      value: `${complexity}/100`,
    },
    {
      className: techDebt > 50 ? "bg-destructive/10" : "bg-success/10",
      description: techDebt > 50 ? t("tech_debt_desc_urgent") : t("tech_debt_desc_low"),
      icon: AlertTriangle,
      iconClass: techDebt > 50 ? "text-destructive" : "text-success",
      id: "tech-debt",
      label: t("tech_debt_label"),
      meter: techDebt,
      tone: techDebt > 50 ? "danger" : "success",
      value: `${techDebt}/100`,
    },
    {
      className: onboarding > 70 ? "bg-success/10" : "bg-warning/10",
      description: onboarding > 70 ? t("onboarding_desc_easy") : t("onboarding_desc_hard"),
      icon: Book,
      iconClass: onboarding > 70 ? "text-success" : "text-warning",
      id: "onboarding",
      label: t("onboarding_label"),
      meter: onboarding,
      tone: onboarding > 70 ? "success" : "warning",
      value: `${onboarding}/100`,
    },
  ];

  const REPO_SIGNALS = [
    {
      label: t("signal_coverage"),
      value: (s: Signals) => `${s.analysisCoverage.parserCoveragePercent}%`,
    },
    { label: t("signal_bus_factor"), value: (s: Signals) => s.busFactor },
    { label: t("signal_api"), value: (s: Signals) => s.apiSurface },
    { label: t("signal_cycles"), value: (s: Signals) => s.dependencyCycles },
    { label: t("signal_docs"), value: (s: Signals) => `${s.docDensity}%` },
    { label: t("signal_duplication"), value: (s: Signals) => `${s.duplicationPercentage}%` },
  ] as const;

  const REPO_BASE_STATS = [
    {
      label: t("stat_lines"),
      value: (s: typeof secondary.stats) => `${(s.linesOfCode / 1000).toFixed(1)}k`,
    },
    { label: t("stat_files"), value: (s: typeof secondary.stats) => s.fileCount },
    { label: t("stat_size"), value: (s: typeof secondary.stats) => s.totalSizeLabel },
    { label: t("stat_config_files"), value: (s: typeof secondary.stats) => s.configFiles },
  ] as const;

  const totalLines = secondary.stats.linesOfCode;
  const getLangPercent = (lines: number) => (totalLines > 0 ? (lines / totalLines) * 100 : 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{t("executive_summary")}</span>

                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{repo.name}</CardTitle>
                  <StatusBadge
                    className="capitalize"
                    tone={maintenanceTone}
                  >
                    <HeartPulse />
                    {summary.maintenance}
                  </StatusBadge>
                  <AppBadge variant="outline">{summary.architectureStyle}</AppBadge>
                </div>
              </div>

              <CardDescription className="max-w-[80ch]">{summary.purpose}</CardDescription>

              <CardAction>
                <AppButton
                  asChild
                  size="sm"
                  variant="outline"
                >
                  <Link href={buildRepoDocsHref({ aid, name, owner })}>
                    {t("sidebar_documentation")}
                  </Link>
                </AppButton>
              </CardAction>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {summary.stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.stack.map((tech) => (
                    <AppBadge
                      key={tech}
                      variant="secondary"
                    >
                      {tech}
                    </AppBadge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-muted-foreground text-xs">
                {repo.pushedAt != null ? (
                  <TimeAgo
                    date={repo.pushedAt}
                    locale={locale}
                    tooltipLabel={t("repo_last_updated")}
                  />
                ) : (
                  <span />
                )}

                <span>
                  {secondary.stats.linesOfCode.toLocaleString(locale)} {t("lines")}
                  {" · "}
                  {secondary.stats.fileCount} {t("repo_pull_unit_files")}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card
            className="gap-3 px-6 py-4"
            size="compact"
          >
            <p className="font-semibold text-sm">{t("workspace_search")}</p>
            <RepoWorkspaceSearch repoId={repo.id} />
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("start_from_here")}</CardTitle>

            <CardAction>
              <AppButton
                asChild
                size="sm"
                variant="ghost"
              >
                <Link href={buildRepoMapHref({ aid, name, owner })}>
                  {t("repo_pull_open_in_map")}
                  <ArrowRight />
                </Link>
              </AppButton>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {navigation.keyZones.length > 0 && (
              <section className="flex flex-col gap-1">
                <p className="px-2 text-muted-foreground text-xs">{t("key_zones")}</p>

                <div className="flex flex-col">
                  {navigation.keyZones.map((zone) => (
                    <button
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-standard hover:bg-surface-hover/40"
                      key={zone.id}
                      onClick={() => handleMapNodeNavigation(zone.id)}
                      type="button"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-tile bg-surface-hover text-muted-foreground">
                        <Layers className="size-3.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-sm">{zone.label}</span>
                        <span className="block truncate text-muted-foreground text-xs">
                          {zone.path}
                        </span>
                      </span>

                      {zone.stats.pathCount > 0 && (
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {zone.stats.pathCount} {t("repo_pull_unit_files")}
                        </span>
                      )}

                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {navigation.primaryEntrypoints.length > 0 && (
              <section className="flex flex-col gap-1">
                <p className="px-2 text-muted-foreground text-xs">{t("entrypoints")}</p>

                <div className="flex flex-col">
                  {navigation.primaryEntrypoints.map((path) => {
                    const fileName = path.split("/").pop() ?? path;
                    const dirName = path.split("/").slice(0, -1).join("/");

                    return (
                      <button
                        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-standard hover:bg-surface-hover/40"
                        key={path}
                        onClick={() => handleCodeNavigation(path)}
                        type="button"
                      >
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />

                        <span className="min-w-0 flex-1 truncate font-medium text-xs">
                          {fileName}
                        </span>

                        {dirName.length > 0 && (
                          <span className="hidden max-w-[45%] truncate text-muted-foreground text-xs sm:block">
                            {dirName}
                          </span>
                        )}

                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {REPO_STATS_CARDS.map((item) => (
          <StatCard
            key={item.id}
            {...item}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 /> {t("repository_stats")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
            {REPO_BASE_STATS.map((stat) => (
              <div
                className="min-w-0"
                key={stat.label}
              >
                <p className="text-muted-foreground text-xs">{stat.label}</p>
                <p className="mt-0.5 font-semibold text-lg">{stat.value(secondary.stats)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GitHubIcon className="size-4" /> {t("github_stats")}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {gitMetrics.map((metric) => (
                <RepoGitMetric
                  className="min-w-0"
                  color={metric.color}
                  icon={metric.icon}
                  key={metric.id}
                  label={metric.label}
                  showLabel={true}
                  tooltip={t(metric.tooltipKey)}
                />
              ))}
            </div>

            {(data.repo.topics.length > 0 || data.repo.description != null) && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <RepoTopics
                  repoTopics={data.repo.topics}
                  variant="outline"
                />

                {data.repo.description != null && (
                  <p className="line-clamp-2 text-muted-foreground text-sm">
                    {data.repo.description}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles /> {t("analysis_signals")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4">
            {REPO_SIGNALS.map((signal) => (
              <div
                className="min-w-0"
                key={signal.label}
              >
                <p className="truncate text-muted-foreground text-xs">{signal.label}</p>
                <p className="mt-0.5 font-semibold text-base">{signal.value(secondary.signals)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText /> {t("documentation")}
            </CardTitle>

            <CardDescription>
              {t("docs_available", { count: docs.availableCount })}
              {docs.hasSwagger && ` · ${t("swagger")}`}
            </CardDescription>

            <CardAction>
              <AppButton
                asChild
                size="sm"
                variant="ghost"
              >
                <Link href={buildRepoDocsHref({ aid, name, owner })}>
                  {t("view")}
                  <ArrowRight />
                </Link>
              </AppButton>
            </CardAction>
          </CardHeader>

          <CardContent>
            {docs.items.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("repo_docs_empty_title")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {docs.items.map((doc) => (
                  <Link
                    className="group flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 transition-standard hover:bg-surface-hover/40"
                    href={buildRepoDocsHref({
                      aid,
                      docType: doc.type,
                      name,
                      owner,
                    })}
                    key={doc.id}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-hover text-muted-foreground">
                      <FileText className="size-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">
                        {t(DOC_LABEL_KEYS[doc.type] ?? "documentation")}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {t("repo_docs_version", { version: doc.version })}
                        {" · "}
                        <TimeAgo
                          date={doc.updatedAt}
                          locale={locale}
                        />
                      </span>
                    </span>

                    {doc.status === "failed" && (
                      <AppBadge
                        className="border-destructive/30 text-destructive"
                        variant="outline"
                      >
                        {tCommon("failed")}
                      </AppBadge>
                    )}

                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">{t("languages")}</CardTitle>
              <span className="text-muted-foreground text-xs">
                {totalLines.toLocaleString(locale)} {t("lines")}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              {secondary.languages.map((lang) => (
                <div
                  key={lang.name}
                  style={{
                    backgroundColor: lang.color,
                    width: `${getLangPercent(lang.lines)}%`,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col">
              {secondary.languages.map((lang) => (
                <div
                  className="flex items-center gap-2 py-1.5 text-xs"
                  key={lang.name}
                >
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: lang.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{lang.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(getLangPercent(lang.lines))}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpenCheck />
              {t("quality_snapshot")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {[
              { label: t("quality_health"), value: health },
              { label: t("quality_security"), value: security },
              { label: t("quality_simplicity"), value: 100 - complexity },
              { label: t("quality_onboarding"), value: onboarding },
              { label: t("quality_maintainability"), value: 100 - techDebt },
            ].map((row) => (
              <div
                className="flex items-center justify-between gap-2 border-t py-2 text-xs first:border-t-0 first:pt-0 last:pb-0"
                key={row.label}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    "font-medium",
                    row.value >= 75
                      ? "text-success"
                      : row.value >= 50
                        ? "text-warning"
                        : "text-destructive",
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="text-warning" /> {t("complex_files")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.mostComplexFiles.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">{t("no_data_yet")}</p>
            ) : (
              <div className="flex flex-col">
                {data.mostComplexFiles.slice(0, 6).map((file, idx) => (
                  <div
                    className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-standard hover:bg-surface-hover/40"
                    key={file}
                  >
                    <span className="w-4 shrink-0 text-muted-foreground text-xs">{idx + 1}</span>
                    <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{file}</span>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                      <AppTooltip content={t("view_code")}>
                        <AppButton
                          asChild
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Link
                            aria-label={t("view_code_for", { file })}
                            href={`/dashboard/repo/${owner}/${name}/code?node=file:${encodeURIComponent(file)}&path=${encodeURIComponent(file)}`}
                          >
                            <Code2 className="size-3.5" />
                          </Link>
                        </AppButton>
                      </AppTooltip>

                      <AppTooltip content={t("view_on_map")}>
                        <AppButton
                          asChild
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Link
                            aria-label={t("view_on_map_for", { file })}
                            href={`/dashboard/repo/${owner}/${name}/map?node=file:${encodeURIComponent(file)}&path=${encodeURIComponent(file)}`}
                          >
                            <Map className="size-3.5" />
                          </Link>
                        </AppButton>
                      </AppTooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.mostComplexFiles.length > 6 && (
              <p className="text-muted-foreground text-xs">
                {t("repo_version_capped", {
                  shown: 6,
                  total: data.mostComplexFiles.length,
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">{t("top_risks")}</CardTitle>
          </CardHeader>
          <CardContent>
            {topRisks.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("no_significant_risks")}
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {topRisks.map((risk) => {
                  const isHigh = risk.severity === "CRITICAL" || risk.severity === "HIGH";
                  const isModerate = risk.severity === "MODERATE";

                  return (
                    <div
                      className="flex items-start gap-2.5 py-2.5"
                      key={risk.id}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          isHigh
                            ? "bg-destructive"
                            : isModerate
                              ? "bg-warning"
                              : "bg-muted-foreground",
                        )}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{risk.title}</p>
                          <AppBadge
                            className={cn(
                              isHigh && "border-destructive/30 text-destructive",
                              isModerate && "border-warning/30 text-warning",
                            )}
                            variant="outline"
                          >
                            {risk.severity}
                          </AppBadge>
                        </div>

                        <p className="mt-0.5 text-muted-foreground text-xs">{risk.summary}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <TrendsWidget
          className="col-span-1 min-w-0 md:col-span-2 lg:col-span-4"
          repoId={data.repo.id}
        />
      </div>
    </div>
  );
}
