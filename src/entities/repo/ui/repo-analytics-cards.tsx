import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  FileCode,
  Loader2,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import type { RepoMetricsItem } from "../model/repo.types";

export function ArchitectureAndDataFlowCard({
  reference,
}: Readonly<{
  reference: NonNullable<RepoMetricsItem>["reference"];
}>) {
  const flows = [
    { label: "API Structure", value: reference.apiStructure },
    { label: "Data Flow", value: reference.dataFlow },
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Binary className="size-5" /> Architecture & Data Flow
        </CardTitle>
        <CardDescription>How data moves through your system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {flows.map((flow) => (
          <div key={flow.label}>
            <p className="mb-2 text-sm font-medium">{flow.label}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{flow.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RisksCard({ risks }: Readonly<{ risks: NonNullable<RepoMetricsItem>["risks"] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4" /> Risks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.topRisks.length > 0 ? (
          risks.topRisks.map((risk) => (
            <div key={risk.id} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{risk.title}</p>
                <AppBadge variant="outline">{risk.severity}</AppBadge>
              </div>
              <p className="text-muted-foreground text-xs">{risk.summary}</p>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No significant risks detected.</p>
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
  const sections = [
    {
      content: (
        <div className="flex flex-wrap gap-2">
          {architecture.entrypoints.map((entrypoint) => (
            <AppBadge key={entrypoint} variant="outline">
              {entrypoint}
            </AppBadge>
          ))}
        </div>
      ),
      title: "Entrypoints",
    },
    {
      content: (
        <div className="flex flex-wrap gap-2">
          <AppBadge variant="outline">
            ops {architecture.routeInventory?.estimatedOperations ?? 0}
          </AppBadge>
          <AppBadge variant="outline">
            rpc {architecture.routeInventory?.rpcProcedures ?? 0}
          </AppBadge>
          {(architecture.routeInventory?.frameworks ?? []).map((framework) => (
            <AppBadge key={framework} variant="secondary">
              {framework}
            </AppBadge>
          ))}
        </div>
      ),
      title: "Route Inventory",
    },
    {
      content:
        architecture.graphReliability == null ? (
          <p className="text-muted-foreground">No graph reliability data.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AppBadge variant="outline">
              resolved {architecture.graphReliability.resolvedEdges}
            </AppBadge>
            <AppBadge variant="outline">
              unresolved {architecture.graphReliability.unresolvedImportSpecifiers}
            </AppBadge>
          </div>
        ),
      title: "Graph Reliability",
    },
    {
      content: (
        <div className="flex flex-wrap gap-2">
          {architecture.configInventory.map((item) => (
            <AppBadge key={item} variant="outline">
              {item}
            </AppBadge>
          ))}
        </div>
      ),
      title: "Config Inventory",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Terminal className="size-4" /> Reference & Routes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((sec) => (
          <div key={sec.title} className="text-xs">
            <p className="text-muted-foreground mb-2 uppercase">{sec.title}</p>
            {sec.content}
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
    finding: { line?: number; message?: string; suggestion?: string; type?: string }
  ) => void;
  runningFixId: null | string;
  security: NonNullable<RepoMetricsItem>["security"];
}>) {
  return (
    <Card className="border-destructive/20 bg-background shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ShieldAlert className="text-destructive size-5 animate-pulse" /> Security Overview
        </CardTitle>
        <div className="flex flex-col items-end">
          <span className="text-destructive text-3xl font-black tracking-tighter">
            {security.score}
            <span className="text-muted-foreground text-sm font-normal">/10</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge
            variant={security.securityScanStatus === "ok" ? "default" : "secondary"}
            className="text-[10px] font-bold tracking-wider uppercase"
          >
            Scan: {security.securityScanStatus}
          </AppBadge>
          <AppBadge
            variant={security.vulnerabilities.length > 0 ? "destructive" : "outline"}
            className="text-[10px] font-bold"
          >
            {security.vulnerabilities.length} vulnerabilities
          </AppBadge>
          <AppBadge variant="outline" className="text-muted-foreground text-[10px] font-medium">
            {security.findings.length} raw findings
          </AppBadge>
        </div>

        {security.risks.length > 0 && (
          <div className="border-border space-y-2 border-t pt-3">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Identified Attack Vectors
            </span>
            <div className="space-y-1.5">
              {security.risks.map((item) => (
                <div
                  key={item}
                  className="text-foreground/90 flex items-start gap-2 text-xs leading-relaxed"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {security.vulnerabilities.length > 0 ? (
          <div className="border-border space-y-2 border-t pt-3">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Critical Vulnerabilities
            </span>
            <div className="space-y-2">
              {security.vulnerabilities.map((vuln, idx) => {
                const isCurrentlyFixing = runningFixId === vuln.file;

                return (
                  <Collapsible
                    key={idx}
                    className="group border-border bg-muted/30 hover:bg-muted/50 rounded-lg border p-2.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-foreground/80 flex items-center gap-1.5 font-mono text-xs font-semibold">
                          <FileCode className="text-muted-foreground size-3.5" />
                          <span className="max-w-60 truncate md:max-w-xs">[[{vuln.file}]]</span>
                          {vuln.lineHint != null && (
                            <span className="bg-border text-muted-foreground rounded px-1 text-[10px] font-medium">
                              {vuln.lineHint}
                            </span>
                          )}
                        </div>
                        <p className="text-foreground/90 pl-5 text-xs leading-snug font-medium">
                          {vuln.description}
                        </p>
                      </div>

                      <AppBadge
                        variant={
                          vuln.risk === "CRITICAL" || vuln.risk === "HIGH"
                            ? "destructive"
                            : "secondary"
                        }
                        className="shrink-0 text-[9px] font-extrabold uppercase"
                      >
                        {vuln.risk}
                      </AppBadge>
                    </div>

                    <CollapsibleContent className="border-border mt-2.5 space-y-1.5 border-t pt-2 pl-5">
                      <div className="text-destructive flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
                        <Terminal className="size-3" /> Recommended Remediation:
                      </div>
                      <p className="text-muted-foreground bg-background/50 border-border rounded-md border p-2 font-mono text-[11px] leading-normal whitespace-pre-wrap">
                        {vuln.suggestion}
                      </p>
                      {/* NOTE: потом поменять на loading-button.tsx */}
                      <AppButton
                        disabled={runningFixId !== null}
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const parsedLineMatch = vuln.lineHint?.match(/\d+/);
                          const parsedLine =
                            parsedLineMatch != null
                              ? Number.parseInt(parsedLineMatch[0], 10)
                              : undefined;

                          void onTriggerFix(vuln.file, {
                            line: parsedLine,
                            message: vuln.description,
                            suggestion: vuln.suggestion,
                            type: "security",
                          });
                        }}
                        className="mt-3 w-full gap-2 text-[10px] font-bold tracking-wider uppercase"
                      >
                        {isCurrentlyFixing ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        Auto Patch with AI
                      </AppButton>
                    </CollapsibleContent>

                    <CollapsibleTrigger className="text-muted-foreground hover:text-foreground mt-1.5 flex w-full items-center justify-center text-[10px] font-semibold transition-colors">
                      <span className="group-data-[state=open]:hidden">
                        Show Remediation Plan ↓
                      </span>
                      <span className="group-data-[state=closed]:hidden">
                        Hide Remediation Plan ↑
                      </span>
                    </CollapsibleTrigger>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-medium text-emerald-500">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              No critical code vulnerabilities or exposed secrets detected in this inspection cycle.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
