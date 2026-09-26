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
import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import type { RepoMetricsItem } from "../model/repo.types";
import { ComplexityScatterChart } from "./repo-complexity-scatter-chart";

export function SnapshotsSection({
  architecture,
  onboarding,
  quality,
}: Readonly<{
  architecture: NonNullable<RepoMetricsItem>["architecture"];
  onboarding: NonNullable<RepoMetricsItem>["onboarding"];
  quality: NonNullable<RepoMetricsItem>["quality"];
}>) {
  const t = useTranslations("Dashboard");

  const qualityStats = [
    { label: t("quality_health"), value: quality.health },
    { label: t("quality_complexity"), value: quality.complexity },
    { label: t("quality_modularity"), value: quality.modularity },
    { label: t("quality_tech_debt"), value: quality.techDebt },
  ];

  const architectureStats = [
    { label: t("arch_entrypoints"), value: architecture.entrypoints.length },
    { label: t("arch_cycles"), value: architecture.dependencyCycles.length },
    { label: t("arch_orphans"), value: architecture.orphanModules.length },
    { label: t("arch_operations"), value: architecture.routeInventory?.estimatedOperations ?? 0 },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch /> {t("quality_snapshot")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {qualityStats.map((stat) => (
            <div key={stat.label}>
              <p className="font-bold text-[10px] text-muted-foreground uppercase">{stat.label}</p>
              <p className="font-bold text-xl">{stat.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network /> {t("architecture_snapshot")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {architectureStats.map((stat) => (
            <div
              className="flex items-center justify-between"
              key={stat.label}
            >
              <span className="text-muted-foreground">{stat.label}</span>
              <span className="font-medium">{stat.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users /> {t("onboarding")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("onboarding_score")}</span>
            <span className="font-medium">{onboarding.score}</span>
          </div>
          <div>
            <p className="mb-2 text-muted-foreground text-xs uppercase">{t("setup_steps")}</p>
            <ul className="flex flex-col gap-2 text-xs">
              {onboarding.guide.setup_steps.map((step) => (
                <li
                  className="flex items-start gap-2"
                  key={step}
                >
                  <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
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
  const t = useTranslations("Dashboard");

  if (domain.analysis == null) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight">
        <Fingerprint className="size-5 text-blue-400" /> {t("domain_intelligence")}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="py-4">
            <CardTitle className="font-semibold text-sm">{t("core_entities")}</CardTitle>
            <CardDescription>{t("core_entities_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {domain.analysis.core_entities.map((entity) => (
              <div
                className="rounded-md border bg-muted/30 p-3"
                key={entity.name}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-bold font-mono text-blue-400 text-xs">{entity.name}</span>
                  <AppBadge
                    className="h-4 text-[10px]"
                    variant="outline"
                  >
                    {entity.logic_complexity} {t("entity_complexity")}
                  </AppBadge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {entity.responsibility}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="font-semibold text-sm">{t("business_rules")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {domain.analysis.business_rules.map((rule) => (
                <li
                  className="flex items-start gap-2 text-xs text-zinc-300"
                  key={rule}
                >
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
  const t = useTranslations("Dashboard");

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HistoryIcon className="size-4 text-zinc-400" /> {t("tech_debt_inventory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recommendations.techDebtInventory?.map((item) => (
            <div
              className="flex items-center justify-between rounded border bg-muted/10 p-2"
              key={`${item.type}:${item.description}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[10px] text-zinc-500 uppercase">{item.type}</span>
                <span className="text-xs text-zinc-300">{item.description}</span>
              </div>
              <AppBadge
                className="h-4 text-[9px]"
                variant="outline"
              >
                {item.remediation_effort} {t("remediation_effort")}
              </AppBadge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-semibold text-sm">
            {t("complexity_vs_size_analysis")}
          </CardTitle>
          <CardDescription className="text-xs">{t("complexity_vs_size_desc")}</CardDescription>
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
  const t = useTranslations("Dashboard");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <LayoutTemplate className="size-5 text-emerald-400" /> {t("refactoring_backlog")}
        </h2>
        <AppBadge
          className="border-emerald-400/30 text-emerald-400"
          variant="outline"
        >
          {t("targets_identified", { count: recommendations.refactoringTargets.length })}
        </AppBadge>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {recommendations.refactoringTargets.map((item) => (
          <Card
            className="group transition-standard hover:border-emerald-500/40"
            key={item.file}
          >
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <Code2 className="size-3.5 shrink-0 text-zinc-500" />
                <code className="truncate font-mono text-[10px] text-zinc-400">{item.file}</code>
              </div>
              <div className="flex items-center gap-2">
                <AppBadge className="h-4 border-none bg-emerald-500/10 text-[9px] text-emerald-400">
                  {`+${item.impact_on_health} ${t("health")}`}
                </AppBadge>
                <AppBadge
                  className="h-4 text-[9px] uppercase"
                  variant="outline"
                >
                  {item.priority}
                </AppBadge>
              </div>
            </div>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1">
                <p className="font-bold text-[10px] text-zinc-500 uppercase tracking-widest">
                  {item.issue_category}
                </p>
                <p className="text-sm text-zinc-200 leading-snug">{item.description}</p>
              </div>
              {item.original_code != null && (
                <div className="relative">
                  <div className="absolute top-2 right-2 font-bold text-[9px] text-destructive/50 uppercase">
                    {t("legacy")}
                  </div>
                  <pre className="max-h-40 overflow-x-auto rounded border bg-zinc-950 p-3 font-mono text-[10px] text-zinc-500">
                    {item.original_code}
                  </pre>
                </div>
              )}

              <div className="mt-4 border-t pt-2">
                <AppButton
                  className="w-full gap-2 border-emerald-500/30 font-semibold text-emerald-400 text-xs hover:bg-emerald-500/10"
                  disabled={runningFixId !== null}
                  onClick={() =>
                    onTriggerFix(item.file, {
                      line: 1,
                      suggestion: item.description,
                      type: "complexity",
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  {runningFixId !== null ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {t("auto_refactor")}
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
  const t = useTranslations("Dashboard");

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="border-orange-500/20 bg-orange-500/5 lg:col-span-2">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cpu className="size-4 text-orange-400" /> {t("performance_audit")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-orange-500/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-orange-500/10 font-bold text-orange-200 uppercase">
                <tr>
                  <th className="p-2">{t("table_issue")}</th>
                  <th className="p-2">{t("table_location")}</th>
                  <th className="p-2">{t("table_optimization_strategy")}</th>
                  <th className="w-20 p-2 text-center">{t("table_action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-500/10">
                {recommendations.performanceAudit?.map((item) => (
                  <tr
                    className="transition-colors hover:bg-orange-500/5"
                    key={`${item.location}:${item.issue}`}
                  >
                    <td className="p-2 font-medium text-zinc-200">{item.issue}</td>
                    <td className="p-2 font-mono text-[10px] text-orange-300/70">
                      {item.location}
                    </td>
                    <td className="p-2 text-zinc-400">{item.optimization_strategy}</td>
                    <td className="p-2 text-center">
                      <AppButton
                        className="gap-1 border-orange-500/20 font-bold text-[10px] text-orange-400 hover:bg-orange-500/10"
                        disabled={runningFixId !== null}
                        onClick={() =>
                          onTriggerFix(item.location, {
                            line: 1,
                            suggestion: item.optimization_strategy,
                            type: "performance",
                          })
                        }
                        size="icon"
                        variant="outline"
                      >
                        {runningFixId !== null ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        {t("fix")}
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
            <Database className="size-4 text-blue-400" /> {t("scaling_and_state")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-bold text-[10px] text-blue-400 uppercase">{t("statelessness")}</p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {recommendations.infrastructure?.statelessness_check}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-bold text-[10px] text-blue-400 uppercase">
              {t("concurrency_risks")}
            </p>
            <div className="flex flex-wrap gap-1">
              {recommendations.infrastructure?.concurrency_risks.map((risk) => (
                <AppBadge
                  className="py-0 text-[9px]"
                  key={risk}
                  variant="secondary"
                >
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
