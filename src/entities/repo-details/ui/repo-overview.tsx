"use client";

import {
  Activity,
  AlertTriangle,
  Book,
  BookOpen,
  Code2,
  FileCode,
  HeartPulse,
  Layers,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocale } from "next-intl";

import type { RepoDetailsOverview } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";

import { getGitMetrics, RepoGitMetric, RepoTopics } from "@/entities/repo";

import { StatCard } from "./stat-card";

type Props = { data: RepoDetailsOverview };

export function RepoOverview({ data }: Readonly<Props>) {
  const locale = useLocale();

  const gitMetrics = getGitMetrics(data.repo, locale);

  const { languages, maintenance, mostComplexFiles, scores, stats, summary } = data;
  const status =
    maintenance === "active"
      ? "border-success text-success"
      : maintenance === "stale"
        ? "border-warning text-warning"
        : "border-destructive text-destructive";

  const health = scores.healthScore ?? 0;
  const security = scores.securityScore ?? 0;
  const techDebt = scores.techDebtScore ?? 0;
  const onboarding = scores.onboardingScore ?? 0;

  const REPO_STATS_CARDS = [
    {
      className: "bg-suucess/10",
      description:
        scores.healthScore === null
          ? "No health data"
          : health > 75
            ? "Codebase is stable"
            : "Maintenance required",
      icon: Activity,
      iconClass: "text-success",
      id: "health",
      label: "Health Score",
      value: scores.healthScore !== null ? `${scores.healthScore}/100` : "N/A",
    },
    {
      className: "bg-emerald-500/10",
      description:
        scores.securityScore === null
          ? "Security not assessed"
          : security > 80
            ? "No critical leaks"
            : "Check vulnerabilities",
      icon: ShieldCheck,
      iconClass: "text-emerald-500",
      id: "security",
      label: "Security Score",
      value: scores.securityScore !== null ? `${scores.securityScore}/100` : "N/A",
    },
    {
      className: scores.busFactor <= 2 ? "bg-destructive/10" : "bg-blue/10",
      description: scores.busFactor <= 2 ? "Knowledge silo risk" : "Team knowledge shared",
      icon: Users,
      iconClass: scores.busFactor <= 2 ? "text-destructive" : "text-blue",
      id: "bus-factor",
      label: "Bus Factor",
      value: String(scores.busFactor),
    },
    {
      className: scores.complexityScore > 60 ? "bg-destructive/10" : "bg-warning/10",
      description: scores.complexityScore > 60 ? "High cognitive load" : "Logic is manageable",
      icon: Layers,
      iconClass: scores.complexityScore > 60 ? "text-destructive" : "text-warning",
      id: "complexity",
      label: "Complexity",
      value: `${scores.complexityScore}/100`,
    },
    {
      className: scores.docDensity < 20 ? "bg-warning/10" : "bg-success/10",
      description: scores.docDensity < 20 ? "Missing context" : "Well documented",
      icon: BookOpen,
      iconClass: scores.docDensity < 20 ? "text-warning" : "text-success",
      id: "doc-density",
      label: "Documentation",
      value: `${scores.docDensity}%`,
    },
    {
      className: techDebt > 50 ? "bg-destructive/10" : "bg-success/10",
      description:
        scores.techDebtScore === null
          ? "Debt not measured"
          : techDebt > 50
            ? "Refactoring urgent"
            : "Technical debt low",
      icon: AlertTriangle,
      iconClass: techDebt > 50 ? "text-destructive" : "text-success",
      id: "tech-debt",
      label: "Tech Debt",
      value: scores.techDebtScore !== null ? `${scores.techDebtScore}/100` : "N/A",
    },
    {
      className: "bg-blue/10",
      description: scores.modularityScore > 70 ? "Good separation" : "Tight coupling",
      icon: Code2,
      iconClass: "text-blue",
      id: "modularity",
      label: "Modularity",
      value: `${scores.modularityScore}/100`,
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
              <p className="text-xl font-bold">{stats.totalSize}</p>
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
              {languages.slice(0, 6).map((lang) => (
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
              {mostComplexFiles.slice(0, 5).map((file, idx) => (
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
      </div>
    </div>
  );
}
