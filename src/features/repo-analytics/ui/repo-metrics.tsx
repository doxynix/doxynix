"use client";

import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileCode,
  Fingerprint,
  GitBranch,
  HistoryIcon,
  LayoutTemplate,
  Network,
  ShieldAlert,
  Terminal,
  Users,
} from "lucide-react";

import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";

import type { RepoMetricsItem } from "@/entities/repo/model/repo.types";

import { ComplexityScatterChart } from "./repo-complexity-scatter-chart";

type Props = { data: NonNullable<RepoMetricsItem> };

export function RepoMetrics({ data }: Readonly<Props>) {
  const { architecture, domain, quality, recommendations, reference, security } = data;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Binary className="size-5" /> Architecture & Data Flow
            </CardTitle>
            <CardDescription>How data moves through your system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">API Structure</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {reference.apiStructure}
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Data Flow</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{reference.dataFlow}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-error/20 bg-background shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <ShieldAlert className="text-error size-5 animate-pulse" /> Security Overview
              </CardTitle>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-error text-3xl font-black tracking-tighter">
                {security.score}
                <span className="text-muted-foreground text-sm font-normal">/10</span>
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={security.securityScanStatus === "ok" ? "default" : "secondary"}
                className="text-[10px] font-bold tracking-wider uppercase"
              >
                Scan: {security.securityScanStatus}
              </Badge>
              <Badge
                variant={security.vulnerabilities.length > 0 ? "destructive" : "outline"}
                className="text-[10px] font-bold"
              >
                {security.vulnerabilities.length} vulnerabilities
              </Badge>
              <Badge variant="outline" className="text-muted-foreground text-[10px] font-medium">
                {security.findings.length} raw findings
              </Badge>
            </div>

            {security.risks.length > 0 && (
              <div className="border-border/40 space-y-2 border-t pt-3">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Identified Attack Vectors
                </span>
                <div className="space-y-1.5">
                  {security.risks.map((item) => (
                    <div
                      key={item}
                      className="text-foreground/90 flex items-start gap-2 text-xs leading-relaxed"
                    >
                      <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {security.vulnerabilities.length > 0 ? (
              <div className="border-border/40 space-y-2 border-t pt-3">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Critical Vulnerabilities
                </span>
                <div className="space-y-2">
                  {security.vulnerabilities.map((vuln, idx) => (
                    <Collapsible
                      key={idx}
                      className="group border-border/60 bg-muted/30 hover:bg-muted/50 rounded-lg border p-2.5 transition-all"
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

                        <Badge
                          variant={
                            vuln.risk === "CRITICAL" || vuln.risk === "HIGH"
                              ? "destructive"
                              : "secondary"
                          }
                          className="shrink-0 text-[9px] font-extrabold uppercase"
                        >
                          {vuln.risk}
                        </Badge>
                      </div>

                      <CollapsibleContent className="border-border/40 mt-2.5 space-y-1.5 border-t pt-2 pl-5">
                        <div className="text-error flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
                          <Terminal className="size-3" /> Recommended Remediation:
                        </div>
                        <p className="text-muted-foreground bg-background/50 border-border/40 rounded-md border p-2 font-mono text-[11px] leading-normal whitespace-pre-wrap">
                          {vuln.suggestion}
                        </p>
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
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-success/20 bg-success/5 text-success flex items-center gap-2 rounded-lg border p-3 text-xs font-medium">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  No critical code vulnerabilities or exposed secrets detected in this inspection
                  cycle.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GitBranch /> Quality Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Health</p>
              <p className="text-xl font-bold">{quality.health}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Complexity</p>
              <p className="text-xl font-bold">{quality.complexity}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Modularity</p>
              <p className="text-xl font-bold">{quality.modularity}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Tech Debt</p>
              <p className="text-xl font-bold">{quality.techDebt}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network /> Architecture Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Entrypoints</span>
              <span className="font-medium">{data.architecture.entrypoints.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cycles</span>
              <span className="font-medium">{data.architecture.dependencyCycles.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Orphans</span>
              <span className="font-medium">{data.architecture.orphanModules.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Operations</span>
              <span className="font-medium">
                {data.architecture.routeInventory?.estimatedOperations ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users /> Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score</span>
              <span className="font-medium">{data.onboarding.score}</span>
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs uppercase">Setup Steps</p>
              <ul className="space-y-2 text-xs">
                {data.onboarding.guide.setup_steps.map((step) => (
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Terminal /> Reference & Routes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs">
              <p className="text-muted-foreground mb-2 uppercase">Entrypoints</p>
              <div className="flex flex-wrap gap-2">
                {data.architecture.entrypoints.map((entrypoint) => (
                  <Badge key={entrypoint} variant="outline">
                    {entrypoint}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground mb-2 uppercase">Route Inventory</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  ops {data.architecture.routeInventory?.estimatedOperations ?? 0}
                </Badge>
                <Badge variant="outline">
                  rpc {data.architecture.routeInventory?.rpcProcedures ?? 0}
                </Badge>
                {(data.architecture.routeInventory?.frameworks ?? []).map((framework) => (
                  <Badge key={framework} variant="secondary">
                    {framework}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground mb-2 uppercase">Graph Reliability</p>
              {data.architecture.graphReliability == null ? (
                <p className="text-muted-foreground">No graph reliability data.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    resolved {data.architecture.graphReliability.resolvedEdges}
                  </Badge>
                  <Badge variant="outline">
                    unresolved {data.architecture.graphReliability.unresolvedImportSpecifiers}
                  </Badge>
                </div>
              )}
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground mb-2 uppercase">Config Inventory</p>
              <div className="flex flex-wrap gap-2">
                {data.architecture.configInventory.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {domain.analysis != null && (
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Fingerprint className="size-5 text-blue-400" /> Domain Intelligence
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-semibold">Core Entities</CardTitle>
                  <CardDescription>
                    Primary domain objects and their responsibilities
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {domain.analysis.core_entities.map((entity) => (
                    <div key={entity.name} className="bg-muted/30 rounded-md border p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          {entity.name}
                        </span>
                        <Badge variant="outline" className="h-4 text-[10px]">
                          {entity.logic_complexity} Complexity
                        </Badge>
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
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle /> Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.risks.topRisks.length > 0 ? (
              data.risks.topRisks.map((risk) => (
                <div key={risk.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{risk.title}</p>
                    <Badge variant="outline">{risk.severity}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{risk.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No significant risks detected.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HistoryIcon className="size-4 text-zinc-400" /> Tech Debt Inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.techDebtInventory.map((item, i) => (
              <div
                key={i}
                className="bg-muted/10 flex items-center justify-between rounded border p-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">{item.type}</span>
                  <span className="text-xs text-zinc-300">{item.description}</span>
                </div>
                <Badge variant="outline" className="h-4 text-[9px]">
                  {item.remediation_effort} Effort
                </Badge>
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <LayoutTemplate className="size-5 text-emerald-400" /> Refactoring Backlog
          </h3>
          <Badge variant="outline" className="border-emerald-400/30 text-emerald-400">
            {recommendations.refactoringTargets.length} Targets Identified
          </Badge>
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
                  <Badge className="h-4 border-none bg-emerald-500/10 text-[9px] text-emerald-400">
                    +{item.impact_on_health} Health
                  </Badge>
                  <Badge variant="outline" className="h-4 text-[9px] uppercase">
                    {item.priority}
                  </Badge>
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
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-500/10">
                  {recommendations.performanceAudit.map((item, i) => (
                    <tr key={i} className="transition-colors hover:bg-orange-500/5">
                      <td className="p-2 font-medium text-zinc-200">{item.issue}</td>
                      <td className="p-2 font-mono text-[10px] text-orange-300/70">
                        {item.location}
                      </td>
                      <td className="p-2 text-zinc-400">{item.optimization_strategy}</td>
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
                {recommendations.infrastructure.statelessness_check}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-blue-400 uppercase">Concurrency Risks</p>
              <div className="flex flex-wrap gap-1">
                {recommendations.infrastructure.concurrency_risks.map((risk, i) => (
                  <Badge key={i} variant="secondary" className="py-0 text-[9px]">
                    {risk}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
