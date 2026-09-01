"use client";

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
import { useLocale } from "next-intl";

import { Link, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { getGitMetrics } from "@/entities/repo/model/git-metrics";
import type { RepoWorkspace } from "@/entities/repo/model/repo.types";
import { buildRepoSearchResultHref } from "@/entities/repo/model/repo-workspace-navigation";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";
import { RepoGitMetric } from "@/entities/repo/ui/repo-git-metric";
import { RepoTopics } from "@/entities/repo/ui/repo-topics";
import { StatCard } from "@/entities/repo/ui/stat-card";

import { QualityRadar } from "@/widgets/dashboard/ui/analytics-widgets";
import { TrendsWidget } from "@/widgets/dashboard/ui/trends-widget";

import { RepoWorkspaceSearch } from "./repo-workspace-search";

type Props = { data: NonNullable<RepoWorkspace> };

type Signals = Props["data"]["secondary"]["signals"];

export function RepoOverview({ data }: Readonly<Props>) {
  const locale = useLocale();
  const router = useRouter();
  const { aid, name, owner } = useRepoParams();

  const gitMetrics = getGitMetrics(data.repo, locale);

  const { docs, navigation, repo, secondary, summary, topRisks } = data;
  const status =
    summary.maintenance === "active"
      ? "border-success text-success"
      : summary.maintenance === "stale"
        ? "border-warning text-warning"
        : "border-destructive text-destructive";

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
          description: "Workspace node",
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
          description: "Workspace file",
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

  const REPO_STATS_CARDS = [
    {
      className: "bg-success/10",
      description: health > 75 ? "Codebase is stable" : "Maintenance required",
      icon: Activity,
      iconClass: "text-success",
      id: "health",
      label: "Health Score",
      value: `${health}/100`,
    },
    {
      className: "bg-emerald-500/10",
      description: security > 80 ? "No critical leaks" : "Check vulnerabilities",
      icon: ShieldCheck,
      iconClass: "text-emerald-500",
      id: "security",
      label: "Security Score",
      value: `${security}/100`,
    },
    {
      className: complexity > 60 ? "bg-destructive/10" : "bg-warning/10",
      description: complexity > 60 ? "High cognitive load" : "Logic is manageable",
      icon: Layers,
      iconClass: complexity > 60 ? "text-destructive" : "text-warning",
      id: "complexity",
      label: "Complexity",
      value: `${complexity}/100`,
    },
    {
      className: techDebt > 50 ? "bg-destructive/10" : "bg-success/10",
      description: techDebt > 50 ? "Refactoring urgent" : "Technical debt low",
      icon: AlertTriangle,
      iconClass: techDebt > 50 ? "text-destructive" : "text-success",
      id: "tech-debt",
      label: "Tech Debt",
      value: `${techDebt}/100`,
    },
    {
      className: "bg-blue/10",
      description: onboarding > 70 ? "Easy" : "Hard",
      icon: Book,
      iconClass: "text-blue",
      id: "onboarding",
      label: "Onboarding",
      value: `${onboarding}/100`,
    },
  ];

  const REPO_SIGNALS = [
    { label: "Coverage", value: (s: Signals) => `${s.analysisCoverage.parserCoveragePercent}%` },
    { label: "Bus Factor", value: (s: Signals) => s.busFactor },
    { label: "API", value: (s: Signals) => s.apiSurface },
    { label: "Cycles", value: (s: Signals) => s.dependencyCycles },
    { label: "Docs", value: (s: Signals) => `${s.docDensity}%` },
    { label: "Duplication", value: (s: Signals) => `${s.duplicationPercentage}%` },
  ] as const;

  const REPO_BASE_STATS = [
    {
      label: "Lines",
      value: (s: typeof secondary.stats) => `${(s.linesOfCode / 1000).toFixed(1)}k`,
    },
    { label: "Files", value: (s: typeof secondary.stats) => s.fileCount },
    { label: "Size", value: (s: typeof secondary.stats) => s.totalSizeLabel },
    { label: "Config Files", value: (s: typeof secondary.stats) => s.configFiles },
  ] as const;

  const totalLines = secondary.stats.linesOfCode;
  const getLangPercent = (lines: number) => (totalLines > 0 ? (lines / totalLines) * 100 : 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="font-bold text-lg">Executive Summary</CardTitle>
              <AppBadge className={cn("capitalize", status)} variant="outline">
                <HeartPulse className="mr-1 size-3" />
                {summary.maintenance}
              </AppBadge>
            </div>
            <AppBadge variant="outline">{summary.architectureStyle}</AppBadge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">{summary.purpose}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.stack.map((tech) => (
              <AppBadge key={tech} variant="secondary">
                {tech}
              </AppBadge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="font-medium text-sm">Workspace Search</CardTitle>
          </CardHeader>
          <CardContent>
            <RepoWorkspaceSearch repoId={repo.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-medium text-sm">Start From Here</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="font-bold text-muted-foreground text-xs">Key Zones</p>
              <div className="flex flex-wrap gap-2">
                {navigation.keyZones.map((zone) => (
                  <AppButton
                    className="max-w-full gap-2"
                    key={zone.id}
                    onClick={() => handleMapNodeNavigation(zone.id)}
                    variant="outline"
                  >
                    <Layers className="size-3.5" />
                    <span className="truncate">{zone.label}</span>
                  </AppButton>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-bold text-muted-foreground text-xs">Entrypoints</p>
              <div className="flex flex-wrap gap-2">
                {navigation.primaryEntrypoints.map((path) => (
                  <AppButton
                    className="max-w-full justify-start gap-2 px-2"
                    key={path}
                    onClick={() => handleCodeNavigation(path)}
                    variant="ghost"
                  >
                    <ArrowRight className="size-3.5" />
                    <span className="truncate">{path.split("/").pop() ?? path}</span>
                  </AppButton>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {REPO_STATS_CARDS.map((item) => (
          <StatCard key={item.id} {...item} />
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Code2 /> Repository Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {REPO_BASE_STATS.map((stat) => (
              <div key={stat.label}>
                <p className="font-bold text-muted-foreground text-xs">{stat.label}</p>
                <p className="text-xl">{stat.value(secondary.stats)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GitHubIcon className="size-4" /> Github Stats
            </CardTitle>
          </CardHeader>

          <CardContent className="mt-1 flex flex-wrap items-center not-md:justify-center gap-3">
            {gitMetrics.map((m) => (
              <RepoGitMetric
                className={cn(
                  "text-muted-foreground text-xs transition-colors hover:text-foreground",
                  m.className,
                )}
                color={m.color}
                icon={m.icon}
                key={m.id}
                label={m.label}
                tooltip={m.tooltip}
              />
            ))}
            <RepoTopics repoTopics={data.repo.topics} />
            <p className="text-muted-foreground text-sm">{data.repo.description}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Sparkles /> Analysis Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {REPO_SIGNALS.map((signal) => (
              <div className="flex flex-col gap-1" key={signal.label}>
                <p className="font-bold text-muted-foreground text-xs">{signal.label}</p>
                <p className="font-black text-xl">{signal.value(secondary.signals)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 font-medium text-sm">
              <div className="flex items-center gap-2">
                <FileText /> Documentation
              </div>
              <AppButton asChild variant="ghost">
                <Link href={`/dashboard/repo/${data.repo.owner}/${data.repo.name}/docs`}>View</Link>
              </AppButton>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">{docs.availableCount} docs available</p>
            <div className="flex flex-wrap gap-2">
              {docs.items.map((item) => (
                <AppBadge key={item.id} variant="outline">
                  {item.type.toLowerCase().replace("_", " ")} {item.status}
                </AppBadge>
              ))}
              {docs.hasSwagger && <AppBadge variant="secondary">swagger</AppBadge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-medium text-sm">Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full">
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
            <div className="grid grid-cols-3 gap-y-2">
              {secondary.languages.map((lang) => (
                <div className="flex flex-col text-xs" key={lang.name}>
                  <span className="flex items-center gap-1 font-bold">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: lang.color }}
                    />
                    {lang.name}
                  </span>
                  <span className="ml-2.5 text-muted-foreground">
                    {Math.round(getLangPercent(lang.lines))}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 text-sm">
                <BookOpenCheck />
                Quality Radar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <QualityRadar scores={data.secondary.scores} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm text-warning">
              <AlertTriangle /> Complex Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {data.mostComplexFiles.map((file, idx) => (
                <div
                  className="flex w-full items-center justify-between rounded p-1 text-sm transition-colors"
                  key={file}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">{idx + 1}.</span>
                    <FileIcon />
                    <span className="truncate">{file}</span>
                  </div>
                  <div>
                    <AppTooltip content="View code">
                      <AppButton asChild size="icon" variant="ghost">
                        <Link
                          aria-label={`View code for ${file}`}
                          href={`/dashboard/repo/${owner}/${name}/code?node=file:${encodeURIComponent(file)}&path=${encodeURIComponent(file)}`}
                        >
                          <Code2 />
                        </Link>
                      </AppButton>
                    </AppTooltip>
                    <AppTooltip content="View on map">
                      <AppButton asChild size="icon" variant="ghost">
                        <Link
                          aria-label={`View ${file} on map`}
                          href={`/dashboard/repo/${owner}/${name}/map?node=file:${encodeURIComponent(file)}&path=${encodeURIComponent(file)}`}
                        >
                          <Map />
                        </Link>
                      </AppButton>
                    </AppTooltip>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-medium text-sm">Top Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {topRisks.length > 0 ? (
                topRisks.map((risk) => (
                  <div className="rounded-lg border p-3" key={risk.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{risk.title}</p>
                      <AppBadge variant="outline">{risk.severity}</AppBadge>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{risk.summary}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No significant risks detected.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <TrendsWidget className="col-span-4" repoId={data.repo.id} />
      </div>
    </div>
  );
}
