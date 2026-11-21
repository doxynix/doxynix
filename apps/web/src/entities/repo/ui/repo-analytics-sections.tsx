import type { ComponentType } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import {
  CheckCircle2,
  Cpu,
  Database,
  Fingerprint,
  GitBranch,
  HistoryIcon,
  LayoutTemplate,
  Network,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { RepoMetricsItem } from "../model/repo.types";
import { ComplexityScatterChart } from "./repo-complexity-scatter-chart";

type FixTriggerFinding = {
  line?: null | number;
  message?: null | string;
  suggestion?: string;
  type?: null | string;
};

type SnapshotTone = "danger" | "default" | "success" | "warning";

const SNAPSHOT_TILES: Record<SnapshotTone, string> = {
  danger: "bg-destructive/10 text-destructive",
  default: "bg-surface-hover text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

const SNAPSHOT_VALUES: Record<SnapshotTone, string> = {
  danger: "text-destructive",
  default: "",
  success: "text-success",
  warning: "text-warning",
};

function SnapshotHeader({
  icon: Icon,
  title,
  tone = "default",
}: Readonly<{ icon: ComponentType<{ className?: string }>; title: string; tone?: SnapshotTone }>) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          SNAPSHOT_TILES[tone],
        )}
      >
        <Icon />
      </div>

      <p className="min-w-0 flex-1 font-semibold text-sm">{title}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  tone = "default",
  value,
}: Readonly<{ label: string; tone?: SnapshotTone; value: number | string }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("font-medium text-sm", SNAPSHOT_VALUES[tone])}>{value}</span>
    </div>
  );
}

function scoreTone(value: number): SnapshotTone {
  if (value >= 75) {
    return "success";
  }

  if (value >= 50) {
    return "warning";
  }

  return "danger";
}

const LEVEL_TONES: Record<"HIGH" | "LOW" | "MEDIUM", string> = {
  HIGH: "border-destructive/30 text-destructive",
  LOW: "border-success/30 text-success",
  MEDIUM: "border-warning/30 text-warning",
};

function formatEnumLabel(value: string) {
  const normalized = value.toLowerCase().replaceAll("_", " ");

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

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

  const cycles = architecture.dependencyCycles.length;
  const orphans = architecture.orphanModules.length;

  const qualityTone: SnapshotTone =
    quality.health >= 75 ? "success" : quality.health >= 50 ? "warning" : "danger";

  const architectureTone: SnapshotTone = cycles > 0 ? "warning" : "success";

  const onboardingTone = scoreTone(onboarding.score);

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card
        className="gap-3"
        size="compact"
      >
        <SnapshotHeader
          icon={GitBranch}
          title={t("quality_snapshot")}
          tone={qualityTone}
        />

        <div className="flex flex-col">
          <SnapshotRow
            label={t("quality_health")}
            tone={scoreTone(quality.health)}
            value={quality.health}
          />
          <SnapshotRow
            label={t("quality_modularity")}
            tone={scoreTone(quality.modularity)}
            value={quality.modularity}
          />
          <SnapshotRow
            label={t("quality_complexity")}
            tone={
              quality.complexity > 60 ? "danger" : quality.complexity > 40 ? "warning" : "success"
            }
            value={quality.complexity}
          />
          <SnapshotRow
            label={t("quality_tech_debt")}
            tone={quality.techDebt > 50 ? "danger" : quality.techDebt > 30 ? "warning" : "success"}
            value={quality.techDebt}
          />
        </div>
      </Card>

      <Card
        className="gap-3"
        size="compact"
      >
        <SnapshotHeader
          icon={Network}
          title={t("architecture_snapshot")}
          tone={architectureTone}
        />

        <div className="flex flex-col">
          <SnapshotRow
            label={t("arch_entrypoints")}
            value={architecture.entrypoints.length}
          />
          <SnapshotRow
            label={t("arch_cycles")}
            tone={cycles > 0 ? "danger" : "success"}
            value={cycles}
          />
          <SnapshotRow
            label={t("arch_orphans")}
            tone={orphans > 0 ? "warning" : "success"}
            value={orphans}
          />
          <SnapshotRow
            label={t("arch_operations")}
            value={architecture.routeInventory?.estimatedOperations ?? 0}
          />
        </div>
      </Card>

      <Card
        className="gap-3"
        size="compact"
      >
        <SnapshotHeader
          icon={Users}
          title={t("onboarding")}
          tone={onboardingTone}
        />

        <div className="flex flex-col">
          <SnapshotRow
            label={t("onboarding_score")}
            tone={onboardingTone}
            value={onboarding.score}
          />

          <p className="pt-3 pb-1 text-muted-foreground text-xs">{t("setup_steps")}</p>

          {onboarding.guide.setup_steps.length === 0 ? (
            <p className="pt-1 text-muted-foreground text-xs">{t("no_data_yet")}</p>
          ) : (
            onboarding.guide.setup_steps.map((step, index) => (
              <div
                className="flex items-start gap-2.5 border-t py-2 last:pb-0"
                key={step}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-2xs text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 text-xs">{step}</span>
              </div>
            ))
          )}
        </div>
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
      <h2 className="flex items-center gap-2 font-semibold text-lg">
        <Fingerprint className="size-5 text-muted-foreground" /> {t("domain_intelligence")}
      </h2>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("core_entities")}</CardTitle>
            <CardDescription>{t("core_entities_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {domain.analysis.core_entities.length === 0 ? (
              <p className="py-4 text-muted-foreground text-sm">{t("no_data_yet")}</p>
            ) : (
              domain.analysis.core_entities.map((entity) => (
                <div
                  className="flex items-start justify-between gap-3 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                  key={entity.name}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{entity.name}</p>
                    <p className="mt-0.5 text-muted-foreground text-xs">{entity.responsibility}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-2xs text-muted-foreground">{t("entity_complexity")}</span>
                    <AppBadge
                      className={LEVEL_TONES[entity.logic_complexity]}
                      variant="outline"
                    >
                      {formatEnumLabel(entity.logic_complexity)}
                    </AppBadge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("business_rules")}</CardTitle>
          </CardHeader>
          <CardContent>
            {domain.analysis.business_rules.length === 0 ? (
              <p className="py-4 text-muted-foreground text-sm">{t("no_data_yet")}</p>
            ) : (
              <ul className="flex flex-col">
                {domain.analysis.business_rules.map((rule) => (
                  <li
                    className="flex items-start gap-2 border-t py-2 first:border-t-0 first:pt-0 last:pb-0"
                    key={rule}
                  >
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                    <span className="text-xs">{rule}</span>
                  </li>
                ))}
              </ul>
            )}
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
    <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="text-muted-foreground" /> {t("tech_debt_inventory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {recommendations.techDebtInventory == null ||
          recommendations.techDebtInventory.length === 0 ? (
            <p className="py-4 text-muted-foreground text-sm">{t("no_data_yet")}</p>
          ) : (
            recommendations.techDebtInventory.map((item) => (
              <div
                className="flex items-start justify-between gap-3 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                key={`${item.type}:${item.description}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs">{formatEnumLabel(item.type)}</p>
                  <p className="mt-0.5 text-muted-foreground text-xs">{item.description}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-2xs text-muted-foreground">{t("remediation_effort")}</span>
                  <AppBadge
                    className={LEVEL_TONES[item.remediation_effort]}
                    variant="outline"
                  >
                    {formatEnumLabel(item.remediation_effort)}
                  </AppBadge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("complexity_vs_size_analysis")}</CardTitle>
          <CardDescription>{t("complexity_vs_size_desc")}</CardDescription>
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
  onTriggerFix: (filePath: string, finding: FixTriggerFinding) => void;
  recommendations: NonNullable<RepoMetricsItem>["recommendations"];
  runningFixId: null | string;
}>) {
  const t = useTranslations("Dashboard");

  const targets = recommendations.refactoringTargets;
  const totalImpact = targets.reduce((sum, item) => sum + (item.impact_on_health ?? 0), 0);

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="text-muted-foreground" /> {t("refactoring_backlog")}
          </CardTitle>

          <CardDescription>
            {t("targets_identified", { count: targets.length })}
            {totalImpact > 0 && ` · +${totalImpact} ${t("health")}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col">
          {targets.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">{t("no_data_yet")}</p>
          ) : (
            targets.map((item) => (
              <Collapsible
                className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                key={item.file}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      item.priority === "HIGH"
                        ? "bg-destructive"
                        : item.priority === "MEDIUM"
                          ? "bg-warning"
                          : "bg-muted-foreground",
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate font-medium text-sm">
                        {item.file.split("/").pop()}
                      </p>
                      <AppBadge
                        className={LEVEL_TONES[item.priority]}
                        variant="outline"
                      >
                        {formatEnumLabel(item.priority)}
                      </AppBadge>
                      {item.impact_on_health != null && (
                        <span className="font-medium text-success text-xs">
                          +{item.impact_on_health} {t("health")}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-muted-foreground text-xs">
                      {item.file.split("/").slice(0, -1).join("/")}
                    </p>

                    <p className="mt-1 text-xs">
                      {item.issue_category != null && (
                        <>
                          <span className="text-muted-foreground">
                            {formatEnumLabel(item.issue_category)}
                          </span>
                          {" · "}
                        </>
                      )}
                      {item.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {item.original_code != null && (
                      <CollapsibleTrigger asChild>
                        <AppButton
                          size="sm"
                          variant="ghost"
                        >
                          {t("view_code")}
                        </AppButton>
                      </CollapsibleTrigger>
                    )}

                    <LoadingButton
                      aria-label={t("auto_refactor")}
                      className="gap-1.5"
                      isLoading={runningFixId !== null}
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
                      <Sparkles className="size-3.5" /> {t("auto_refactor")}
                    </LoadingButton>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="relative mt-3">
                    <span className="absolute top-2 right-2 text-2xs text-muted-foreground">
                      {t("legacy")}
                    </span>

                    <pre className="max-h-40 overflow-x-auto rounded-lg bg-surface-hover/40 p-3 font-mono text-2xs">
                      {item.original_code}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function PerformanceAndScalingSection({
  onTriggerFix,
  recommendations,
  runningFixId,
}: Readonly<{
  onTriggerFix: (filePath: string, finding: FixTriggerFinding) => void;
  recommendations: NonNullable<RepoMetricsItem>["recommendations"];
  runningFixId: null | string;
}>) {
  const t = useTranslations("Dashboard");

  const audit = recommendations.performanceAudit ?? [];
  const concurrencyRisks = recommendations.infrastructure?.concurrency_risks ?? [];

  return (
    <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="text-warning" /> {t("performance_audit")}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col">
          {audit.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">{t("no_data_yet")}</p>
          ) : (
            audit.map((item) => (
              <div
                className="flex items-start gap-2.5 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                key={`${item.location}:${item.issue}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-medium text-sm">{item.issue}</p>
                    <span className="min-w-0 truncate text-muted-foreground text-xs">
                      {item.location}
                    </span>
                  </div>

                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {item.optimization_strategy}
                  </p>
                </div>

                <LoadingButton
                  aria-label={t("fix")}
                  className="shrink-0"
                  isLoading={runningFixId !== null}
                  onClick={() =>
                    onTriggerFix(item.location, {
                      line: 1,
                      suggestion: item.optimization_strategy,
                      type: "performance",
                    })
                  }
                  size="icon-xs"
                  variant="ghost"
                >
                  <Sparkles className="size-3.5" />
                </LoadingButton>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="text-muted-foreground" /> {t("scaling_and_state")}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col">
          <div className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
            <p className="text-muted-foreground text-xs">{t("statelessness")}</p>
            <p className="mt-0.5 text-sm">{recommendations.infrastructure?.statelessness_check}</p>
          </div>

          <div className="border-t py-3">
            <p className="text-muted-foreground text-xs">{t("concurrency_risks")}</p>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {concurrencyRisks.map((risk) => (
                <AppBadge
                  key={risk}
                  variant="outline"
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
