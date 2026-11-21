import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { AlertTriangle, Binary, CheckCircle2, ShieldAlert, Sparkles, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { RepoMetricsItem } from "../model/repo.types";

function riskTone(risk: string) {
  if (risk === "CRITICAL" || risk === "HIGH") {
    return "border-destructive/30 text-destructive";
  }

  if (risk === "MODERATE") {
    return "border-warning/30 text-warning";
  }

  return undefined;
}

function riskDot(risk: string) {
  if (risk === "CRITICAL" || risk === "HIGH") {
    return "bg-destructive";
  }

  if (risk === "MODERATE") {
    return "bg-warning";
  }

  return "bg-muted-foreground";
}

export function ArchitectureAndDataFlowCard({
  reference,
}: Readonly<{
  reference: NonNullable<RepoMetricsItem>["reference"];
}>) {
  const t = useTranslations("Dashboard");

  const flows = [
    { label: t("repo_analytics_api_structure"), value: reference.apiStructure },
    { label: t("repo_analytics_data_flow"), value: reference.dataFlow },
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Binary className="text-muted-foreground" /> {t("repo_analytics_arch_data_flow")}
        </CardTitle>
        <CardDescription>{t("repo_analytics_arch_data_flow_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {flows.map((flow) => (
          <div
            className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
            key={flow.label}
          >
            <p className="text-muted-foreground text-xs">{flow.label}</p>
            <p className="mt-1 text-sm">{flow.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RisksCard({ risks }: Readonly<{ risks: NonNullable<RepoMetricsItem>["risks"] }>) {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="text-warning" /> {t("repo_analytics_risks")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {risks.topRisks.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            {t("repo_analytics_no_risks")}
          </p>
        ) : (
          risks.topRisks.map((risk) => {
            const isHigh = risk.severity === "CRITICAL" || risk.severity === "HIGH";
            const isModerate = risk.severity === "MODERATE";

            return (
              <div
                className="flex items-start gap-2.5 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                key={risk.id}
              >
                <span
                  className={
                    isHigh
                      ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                      : isModerate
                        ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-warning"
                        : "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                  }
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{risk.title}</p>

                    <AppBadge
                      className={
                        isHigh
                          ? "border-destructive/30 text-destructive"
                          : isModerate
                            ? "border-warning/30 text-warning"
                            : undefined
                      }
                      variant="outline"
                    >
                      {risk.severity}
                    </AppBadge>
                  </div>

                  <p className="mt-0.5 text-muted-foreground text-xs">{risk.summary}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function ReferenceAndRoutesCard({
  architecture,
}: Readonly<{
  architecture: NonNullable<RepoMetricsItem>["architecture"];
}>) {
  const t = useTranslations("Dashboard");

  const sections = [
    {
      content: (
        <div className="flex flex-wrap gap-2">
          {architecture.entrypoints.map((entrypoint) => (
            <AppBadge
              key={entrypoint}
              variant="outline"
            >
              {entrypoint}
            </AppBadge>
          ))}
        </div>
      ),
      title: t("repo_analytics_entrypoints"),
    },
    {
      content: (
        <div className="flex flex-wrap gap-2">
          <AppBadge variant="outline">
            {t("repo_analytics_route_ops", {
              count: architecture.routeInventory?.estimatedOperations ?? 0,
            })}
          </AppBadge>
          <AppBadge variant="outline">
            {t("repo_analytics_route_rpc", {
              count: architecture.routeInventory?.rpcProcedures ?? 0,
            })}
          </AppBadge>
          {(architecture.routeInventory?.frameworks ?? []).map((framework) => (
            <AppBadge
              key={framework}
              variant="secondary"
            >
              {framework}
            </AppBadge>
          ))}
        </div>
      ),
      title: t("repo_analytics_route_inventory"),
    },
    {
      content:
        architecture.graphReliability == null ? (
          <p className="text-muted-foreground">{t("repo_analytics_graph_reliability_no_data")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AppBadge variant="outline">
              {t("repo_analytics_graph_resolved", {
                count: architecture.graphReliability.resolvedEdges,
              })}
            </AppBadge>
            <AppBadge variant="outline">
              {t("repo_analytics_graph_unresolved", {
                count: architecture.graphReliability.unresolvedImportSpecifiers,
              })}
            </AppBadge>
          </div>
        ),
      title: t("repo_analytics_graph_reliability"),
    },
    {
      content: (
        <div className="flex flex-wrap gap-2">
          {architecture.configInventory.map((item) => (
            <AppBadge
              key={item}
              variant="outline"
            >
              {item}
            </AppBadge>
          ))}
        </div>
      ),
      title: t("repo_analytics_config_inventory"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="text-muted-foreground" /> {t("repo_analytics_reference_routes")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {sections.map((sec) => (
          <div
            className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
            key={sec.title}
          >
            <p className="text-muted-foreground text-xs">{sec.title}</p>
            <div className="mt-1.5">{sec.content}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
export function SecurityOverviewCard({
  onTriggerFix,
  runningFixId,
  security,
}: Readonly<{
  onTriggerFix: (
    filePath: string,
    finding: { line?: number; message?: string; suggestion?: string; type?: string },
  ) => void;
  runningFixId: null | string;
  security: NonNullable<RepoMetricsItem>["security"];
}>) {
  const t = useTranslations("Dashboard");

  const handleRunFix = (
    vuln: NonNullable<RepoMetricsItem>["security"]["vulnerabilities"][number],
  ) => {
    const parsedLineMatch = vuln.lineHint != null ? /\d+/.exec(vuln.lineHint) : null;
    const parsedLine =
      parsedLineMatch != null ? Number.parseInt(parsedLineMatch[0], 10) : undefined;

    onTriggerFix(vuln.file, {
      line: parsedLine,
      message: vuln.description,
      suggestion: vuln.suggestion,
      type: "security",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="text-destructive" /> {t("repo_analytics_security_overview")}
        </CardTitle>

        <CardDescription>
          {t("repo_analytics_scan_status", { status: security.securityScanStatus })}
          {" · "}
          {t("repo_analytics_vulnerabilities", { count: security.vulnerabilities.length })}
        </CardDescription>

        <CardAction>
          <span
            className={cn(
              "font-semibold text-2xl",
              security.score >= 7
                ? "text-success"
                : security.score >= 4
                  ? "text-warning"
                  : "text-destructive",
            )}
          >
            {security.score}
            <span className="font-normal text-muted-foreground text-xs">/10</span>
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col">
        {security.vulnerabilities.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-success text-xs">
            <CheckCircle2 />
            <span>{t("repo_analytics_no_critical_vulns")}</span>
          </div>
        ) : (
          security.vulnerabilities.map((vuln) => {
            const isCurrentlyFixing = runningFixId === vuln.file;

            return (
              <Collapsible
                className="group border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                key={vuln.file}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", riskDot(vuln.risk))}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-sm">
                        {vuln.file}
                        {vuln.lineHint != null && `:${vuln.lineHint}`}
                      </p>

                      <AppBadge
                        className={riskTone(vuln.risk)}
                        variant="outline"
                      >
                        {vuln.risk.toLowerCase()}
                      </AppBadge>
                    </div>

                    <p className="mt-0.5 text-muted-foreground text-xs">{vuln.description}</p>

                    {vuln.suggestion.length > 0 && (
                      <CollapsibleTrigger asChild>
                        <AppButton
                          className="mt-1 h-auto px-0 py-0 text-xs"
                          size="sm"
                          variant="ghost"
                        >
                          <span className="group-data-[state=open]:hidden">
                            {t("repo_analytics_show_remediation")}
                          </span>
                          <span className="group-data-[state=closed]:hidden">
                            {t("repo_analytics_hide_remediation")}
                          </span>
                        </AppButton>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>

                <CollapsibleContent className="mt-2 pl-4">
                  <p className="text-muted-foreground text-xs">
                    {t("repo_analytics_recommended_remediation")}
                  </p>

                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-hover/40 p-2.5 font-mono text-2xs">
                    {vuln.suggestion}
                  </pre>

                  <LoadingButton
                    className="mt-2 gap-1.5"
                    disabled={runningFixId != null}
                    isLoading={isCurrentlyFixing}
                    onClick={() => handleRunFix(vuln)}
                    size="sm"
                    variant="destructive"
                  >
                    <Sparkles className="size-3.5" /> {t("repo_analytics_auto_patch")}
                  </LoadingButton>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}

        {security.risks.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-muted-foreground text-xs">
              {t("repo_analytics_identified_attack_vectors")}
            </p>

            <div className="mt-1.5 flex flex-col gap-1.5">
              {security.risks.map((item) => (
                <p
                  className="flex items-start gap-2 text-xs"
                  key={item}
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
