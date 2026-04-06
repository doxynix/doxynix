"use client";

import {
  Activity,
  AlertTriangle,
  Book,
  Code2,
  FileCode,
  FileText,
  HeartPulse,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocale } from "next-intl";

import type { RepoDetailsOverview } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";

import { getGitMetrics, RepoGitMetric, RepoTopics } from "@/entities/repo";
import { StatCard } from "@/entities/repo-details";

type Props = { data: NonNullable<RepoDetailsOverview> };

export function RepoOverview({ data }: Readonly<Props>) {
  const locale = useLocale();

  const gitMetrics = getGitMetrics(data.repo, locale);

  const { docs, languages, maintenance, mostComplexFiles, scores, signals, stats, summary } = data;
  const status =
    maintenance === "active"
      ? "border-success text-success"
      : maintenance === "stale"
        ? "border-warning text-warning"
        : "border-destructive text-destructive";

  const health = scores.health;
  const security = scores.security;
  const techDebt = scores.techDebt;
  const onboarding = scores.onboarding;
  const complexity = scores.complexity;

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-bold">Executive Summary</CardTitle>
              <Badge variant="outline" className={cn("capitalize", status)}>
                <HeartPulse className="mr-1 size-3" />
                {maintenance}
              </Badge>
            </div>
            <Badge variant="outline">{summary.architecture_style}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">{summary.purpose}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.stack_details.map((tech) => (
              <Badge key={tech} variant="secondary">
                {tech}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {REPO_STATS_CARDS.map((item) => (
          <StatCard key={item.id} {...item} />
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="size-4" /> Repository Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Lines</p>
              <p className="text-xl font-bold">{(stats.linesOfCode / 1000).toFixed(1)}k</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Files</p>
              <p className="text-xl font-bold">{stats.fileCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Size</p>
              <p className="text-xl font-bold">{stats.totalSizeLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Config Files</p>
              <p className="text-xl font-bold">{stats.configFiles}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GitHubIcon className="size-4" /> Github Stats
            </CardTitle>
          </CardHeader>

          <CardContent className="mt-1 flex flex-wrap items-center gap-3 not-md:justify-center">
            {gitMetrics.map((m) => (
              <RepoGitMetric
                key={m.id}
                color={m.color}
                icon={m.icon}
                label={m.label}
                tooltip={m.tooltip}
                className={cn(
                  "text-muted-foreground hover:text-foreground text-xs transition-colors",
                  m.className
                )}
              />
            ))}
            <RepoTopics repoTopics={data.repo.topics} />
            <p className="text-muted-foreground text-sm">{data.repo.description}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4" /> Analysis Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Coverage</p>
              <p className="text-xl font-bold">{signals.analysisCoverage.parserCoveragePercent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Bus Factor</p>
              <p className="text-xl font-bold">{signals.busFactor}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">API</p>
              <p className="text-xl font-bold">{signals.apiSurface}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Cycles</p>
              <p className="text-xl font-bold">{signals.dependencyCycles}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Docs</p>
              <p className="text-xl font-bold">{signals.docDensity}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Duplication</p>
              <p className="text-xl font-bold">{signals.duplicationPercentage}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4" /> Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-xs">{docs.availableCount} docs available</p>
            <div className="flex flex-wrap gap-2">
              {docs.items.map((item) => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className={item.isFallback ? "border-warning text-warning" : ""}
                >
                  {item.type.toLowerCase().replace("_", " ")}{" "}
                  {item.isFallback ? "fallback" : item.status}
                </Badge>
              ))}
              {docs.hasSwagger && <Badge variant="secondary">swagger</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full">
              {languages.map((lang) => (
                <div
                  key={lang.name}
                  style={{
                    backgroundColor: lang.color,
                    width: `${(lang.lines / stats.linesOfCode) * 100}%`,
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-y-2">
              {languages.map((lang) => (
                <div key={lang.name} className="flex flex-col text-[11px]">
                  <span className="flex items-center gap-1 font-bold">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: lang.color }}
                    />
                    {lang.name}
                  </span>
                  <span className="text-muted-foreground ml-2.5">
                    {Math.round((lang.lines / stats.linesOfCode) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-warning flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4" /> Complex Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mostComplexFiles.map((file, idx) => (
                <div
                  key={file}
                  className="group hover:bg-muted/50 flex items-center justify-between rounded p-1 text-[13px] transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-muted-foreground text-[10px]">{idx + 1}.</span>
                    <FileCode className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{file}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topRisks.length > 0 ? (
                data.topRisks.map((risk) => (
                  <div key={risk.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{risk.title}</p>
                      <Badge variant="outline">{risk.severity}</Badge>
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
      </div>
    </div>
  );
}
