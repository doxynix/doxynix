import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  FileCode,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

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
      <CardContent className="flex flex-col gap-4">
        {flows.map((flow) => (
          <div key={flow.label}>
            <p className="mb-2 font-medium text-sm">{flow.label}</p>
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
      <CardContent className="flex flex-col gap-3">
        {risks.topRisks.length > 0 ? (
          risks.topRisks.map((risk) => (
            <div className="rounded-lg border p-3" key={risk.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{risk.title}</p>
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
      <CardContent className="flex flex-col gap-4">
        {sections.map((sec) => (
          <div className="text-xs" key={sec.title}>
            <p className="mb-2 text-muted-foreground uppercase">{sec.title}</p>
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
    finding: { line?: number; message?: string; suggestion?: string; type?: string },
  ) => void;
  runningFixId: null | string;
  security: NonNullable<RepoMetricsItem>["security"];
}>) {
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
    <Card className="border-destructive/20 bg-background shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <ShieldAlert className="size-5 animate-pulse text-destructive" /> Security Overview
        </CardTitle>
        <div className="flex flex-col items-end">
          <span className="font-black text-3xl text-destructive tracking-tighter">
            {security.score}
            <span className="font-normal text-muted-foreground text-sm">/10</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge
            className="font-bold text-[10px] uppercase tracking-wider"
            variant={security.securityScanStatus === "ok" ? "default" : "secondary"}
          >
            Scan: {security.securityScanStatus}
          </AppBadge>
          <AppBadge
            className="font-bold text-[10px]"
            variant={security.vulnerabilities.length > 0 ? "destructive" : "outline"}
          >
            {security.vulnerabilities.length} vulnerabilities
          </AppBadge>
          <AppBadge className="font-medium text-[10px] text-muted-foreground" variant="outline">
            {security.findings.length} raw findings
          </AppBadge>
        </div>

        {security.risks.length > 0 && (
          <div className="flex flex-col gap-2 border-border border-t pt-3">
            <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
              Identified Attack Vectors
            </span>
            <div className="flex flex-col gap-1.5">
              {security.risks.map((item) => (
                <div
                  className="flex items-start gap-2 text-foreground/90 text-xs leading-relaxed"
                  key={item}
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {security.vulnerabilities.length > 0 ? (
          <div className="flex flex-col gap-2 border-border border-t pt-3">
            <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
              Critical Vulnerabilities
            </span>
            <div className="flex flex-col gap-2">
              {security.vulnerabilities.map((vuln, idx) => {
                const isCurrentlyFixing = runningFixId === vuln.file;

                return (
                  <Collapsible
                    className="group rounded-lg border border-border bg-muted/30 p-2.5 transition-standard hover:bg-muted/50"
                    key={idx}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground/80 text-xs">
                          <FileCode className="size-3.5 text-muted-foreground" />
                          <span className="max-w-60 truncate md:max-w-xs">[[{vuln.file}]]</span>
                          {vuln.lineHint != null && (
                            <span className="rounded bg-border px-1 font-medium text-[10px] text-muted-foreground">
                              {vuln.lineHint}
                            </span>
                          )}
                        </div>
                        <p className="pl-5 font-medium text-foreground/90 text-xs leading-snug">
                          {vuln.description}
                        </p>
                      </div>

                      <AppBadge
                        className="shrink-0 font-extrabold text-[9px] uppercase"
                        variant={
                          vuln.risk === "CRITICAL" || vuln.risk === "HIGH"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {vuln.risk}
                      </AppBadge>
                    </div>

                    <CollapsibleContent className="mt-2.5 flex flex-col gap-1.5 border-border border-t pt-2 pl-5">
                      <div className="flex items-center gap-1 font-bold text-[10px] text-destructive uppercase tracking-wider">
                        <Terminal className="size-3" /> Recommended Remediation:
                      </div>
                      <p className="whitespace-pre-wrap rounded-md border border-border bg-background/50 p-2 font-mono text-[11px] text-muted-foreground leading-normal">
                        {vuln.suggestion}
                      </p>
                      <LoadingButton
                        className="mt-3 w-full gap-2 font-bold uppercase"
                        disabled={runningFixId != null}
                        isLoading={isCurrentlyFixing}
                        onClick={() => handleRunFix(vuln)}
                        size="sm"
                        variant="destructive"
                      >
                        <Sparkles /> Auto Patch with AI
                      </LoadingButton>
                    </CollapsibleContent>

                    <CollapsibleTrigger className="mt-1.5 flex w-full items-center justify-center font-semibold text-[10px] text-muted-foreground transition-colors hover:text-foreground">
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
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 font-medium text-emerald-500 text-xs">
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
