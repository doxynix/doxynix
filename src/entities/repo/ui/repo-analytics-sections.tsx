import {
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Fingerprint,
  GitBranch,
  HistoryIcon,
  LayoutTemplate,
  Loader2,
  Network,
  Sparkles,
  Users,
} from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { ComplexityScatterChart } from "@/features/repo-analytics/ui/repo-complexity-scatter-chart";

import type { RepoMetricsItem } from "../model/repo.types";

export function SnapshotsSection({
  architecture,
  onboarding,
  quality,
}: Readonly<{
  architecture: NonNullable<RepoMetricsItem>["architecture"];
  onboarding: NonNullable<RepoMetricsItem>["onboarding"];
  quality: NonNullable<RepoMetricsItem>["quality"];
}>) {
  const qualityStats = [
    { label: "Health", value: quality.health },
    { label: "Complexity", value: quality.complexity },
    { label: "Modularity", value: quality.modularity },
    { label: "Tech Debt", value: quality.techDebt },
  ];

  const architectureStats = [
    { label: "Entrypoints", value: architecture.entrypoints.length },
    { label: "Cycles", value: architecture.dependencyCycles.length },
    { label: "Orphans", value: architecture.orphanModules.length },
    { label: "Operations", value: architecture.routeInventory?.estimatedOperations ?? 0 },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="size-4" /> Quality Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {qualityStats.map((stat) => (
            <div key={stat.label}>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network className="size-4" /> Architecture Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {architectureStats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{stat.label}</span>
              <span className="font-medium">{stat.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4" /> Onboarding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score</span>
            <span className="font-medium">{onboarding.score}</span>
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-xs uppercase">Setup Steps</p>
            <ul className="space-y-2 text-xs">
              {onboarding.guide.setup_steps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <div className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function DomainIntelligenceSection({
  domain,
}: Readonly<{
  domain: NonNullable<RepoMetricsItem>["domain"];
}>) {
  if (domain.analysis == null) return null;

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Fingerprint className="size-5 text-blue-400" /> Domain Intelligence
      </h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Core Entities</CardTitle>
            <CardDescription>Primary domain objects and their responsibilities</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {domain.analysis.core_entities.map((entity) => (
              <div key={entity.name} className="bg-muted/30 rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-400">{entity.name}</span>
                  <AppBadge variant="outline" className="h-4 text-[10px]">
                    {entity.logic_complexity} Complexity
                  </AppBadge>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {entity.responsibility}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Business Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {domain.analysis.business_rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function TechDebtAndComplexitySection({
  architecture,
  recommendations,
}: Readonly<{
  architecture: NonNullable<RepoMetricsItem>["architecture"];
  recommendations: NonNullable<RepoMetricsItem>["recommendations"];
}>) {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HistoryIcon className="size-4 text-zinc-400" /> Tech Debt Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recommendations.techDebtInventory?.map((item, i) => (
            <div
              key={i}
              className="bg-muted/10 flex items-center justify-between rounded border p-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{item.type}</span>
                <span className="text-xs text-zinc-300">{item.description}</span>
              </div>
              <AppBadge variant="outline" className="h-4 text-[9px]">
                {item.remediation_effort} Effort
              </AppBadge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Complexity vs Size Analysis</CardTitle>
          <CardDescription className="text-xs">
            Correlation between file volume and cognitive load
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComplexityScatterChart data={architecture.hotspotSignals} />
        </CardContent>
      </Card>
    </section>
  );
}

export function RefactoringBacklogSection({
  onTriggerFix,
  recommendations,
  runningFixId,
}: Readonly<{
  onTriggerFix: (filePath: string, finding: any) => void;
  recommendations: NonNullable<RepoMetricsItem>["recommendations"];
  runningFixId: null | string;
}>) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <LayoutTemplate className="size-5 text-emerald-400" /> Refactoring Backlog
        </h3>
        <AppBadge variant="outline" className="border-emerald-400/30 text-emerald-400">
          {recommendations.refactoringTargets.length} Targets Identified
        </AppBadge>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {recommendations.refactoringTargets.map((item) => (
          <Card
            key={item.file}
            className="group transition-all duration-300 hover:border-emerald-500/40"
          >
            <div className="bg-muted/20 flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <Code2 className="size-3.5 shrink-0 text-zinc-500" />
                <code className="truncate font-mono text-[10px] text-zinc-400">{item.file}</code>
              </div>
              <div className="flex items-center gap-2">
                <AppBadge className="h-4 border-none bg-emerald-500/10 text-[9px] text-emerald-400">
                  +{item.impact_on_health} Health
                </AppBadge>
                <AppBadge variant="outline" className="h-4 text-[9px] uppercase">
                  {item.priority}
                </AppBadge>
              </div>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  {item.issue_category}
                </p>
                <p className="text-sm leading-snug text-zinc-200">{item.description}</p>
              </div>
              {item.original_code != null && (
                <div className="relative">
                  <div className="text-destructive/50 absolute top-2 right-2 text-[9px] font-bold uppercase">
                    Legacy
                  </div>
                  <pre className="max-h-40 overflow-x-auto rounded border bg-zinc-950 p-3 font-mono text-[10px] text-zinc-500">
                    {item.original_code}
                  </pre>
                </div>
              )}

              <div className="mt-4 border-t pt-2">
                <AppButton
                  disabled={runningFixId !== null}
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void onTriggerFix(item.file, {
                      line: 1,
                      suggestion: item.description,
                      type: "complexity",
                    })
                  }
                  className="w-full gap-2 border-emerald-500/30 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                >
                  {runningFixId !== null ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Auto Refactor
                </AppButton>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function PerformanceAndScalingSection({
  onTriggerFix,
  recommendations,
  runningFixId,
}: Readonly<{
  onTriggerFix: (filePath: string, finding: any) => void;
  recommendations: NonNullable<RepoMetricsItem>["recommendations"];
  runningFixId: null | string;
}>) {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="border-orange-500/20 bg-orange-500/5 lg:col-span-2">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cpu className="size-4 text-orange-400" /> Performance Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-orange-500/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-orange-500/10 font-bold text-orange-200 uppercase">
                <tr>
                  <th className="p-2">Issue</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Optimization Strategy</th>
                  <th className="w-20 p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-500/10">
                {recommendations.performanceAudit?.map((item, i) => (
                  <tr key={i} className="transition-colors hover:bg-orange-500/5">
                    <td className="p-2 font-medium text-zinc-200">{item.issue}</td>
                    <td className="p-2 font-mono text-[10px] text-orange-300/70">
                      {item.location}
                    </td>
                    <td className="p-2 text-zinc-400">{item.optimization_strategy}</td>
                    <td className="p-2 text-center">
                      <AppButton
                        disabled={runningFixId !== null}
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          void onTriggerFix(item.location, {
                            line: 1,
                            suggestion: item.optimization_strategy,
                            type: "performance",
                          })
                        }
                        className="gap-1 border-orange-500/20 text-[10px] font-bold text-orange-400 hover:bg-orange-500/10"
                      >
                        {runningFixId !== null ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        Fix
                      </AppButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-500/20">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="size-4 text-blue-400" /> Scaling & State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-blue-400 uppercase">Statelessness</p>
            <p className="text-xs leading-relaxed text-zinc-300">
              {recommendations.infrastructure?.statelessness_check}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-blue-400 uppercase">Concurrency Risks</p>
            <div className="flex flex-wrap gap-1">
              {recommendations.infrastructure?.concurrency_risks.map((risk, i) => (
                <AppBadge key={i} variant="secondary" className="py-0 text-[9px]">
                  {risk}
                </AppBadge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
