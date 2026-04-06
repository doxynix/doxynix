"use client";

import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  Construction,
  GitBranch,
  Network,
  ShieldAlert,
  Terminal,
  Users,
  Zap,
} from "lucide-react";

import type { RepoMetricsItem } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = { data: NonNullable<RepoMetricsItem> };

export function RepoMetrics({ data }: Readonly<Props>) {
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
                {data.reference.apiStructure}
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Data Flow</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {data.reference.dataFlow}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-error/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="text-error size-5" /> Security
              </CardTitle>
            </div>
            <div className="text-error text-2xl font-black">{data.security.score}/10</div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="outline">{data.security.securityScanStatus}</Badge>
              <Badge variant="outline">{data.security.findings.length} findings</Badge>
            </div>
            <div className="space-y-3">
              {data.security.risks.map((item) => (
                <div key={item} className="flex gap-2 text-xs">
                  <AlertTriangle className="text-warning size-3.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GitBranch className="size-4" /> Quality Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Health</p>
              <p className="text-xl font-bold">{data.quality.health}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Complexity</p>
              <p className="text-xl font-bold">{data.quality.complexity}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Modularity</p>
              <p className="text-xl font-bold">{data.quality.modularity}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Tech Debt</p>
              <p className="text-xl font-bold">{data.quality.techDebt}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network className="size-4" /> Architecture Snapshot
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
              <Users className="size-4" /> Onboarding
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
              <Terminal className="size-4" /> Reference & Routes
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4" /> Risks
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

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Construction className="text-warning size-5" /> Refactoring Targets
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {data.recommendations.refactoringTargets.length > 0 ? (
            data.recommendations.refactoringTargets.map((item) => (
              <Card key={item.file} className="overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <code className="text-xs">{item.file}</code>
                  <Badge
                    variant="outline"
                    className={cn(item.priority === "HIGH" ? "text-error" : "text-warning")}
                  >
                    {item.priority} PRIORITY
                  </Badge>
                </div>
                <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-tighter uppercase">
                      Current Issue
                    </p>
                    <p className="text-sm">{item.description}</p>
                    {item.original_code != null && (
                      <pre className="border-destructive/20 bg-destructive/15 overflow-x-auto rounded-md border p-3 text-xs">
                        {item.original_code}
                      </pre>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-success text-xs font-medium tracking-tighter uppercase">
                      AI Suggestion
                    </p>
                    <div className="text-success mb-1 flex items-center gap-2 text-xs">
                      <CheckCircle2 className="size-3" /> Improved maintainability
                    </div>
                    {item.improved_code != null && (
                      <div className="group relative">
                        <CopyButton
                          value={item.improved_code}
                          tooltipText="Copy"
                          className="absolute top-2 right-2"
                        />
                        <pre className="border-success/20 bg-success/15 overflow-x-auto rounded-md border p-3 text-xs">
                          {item.improved_code}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">
                No refactoring targets suggested by the analysis.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="bg-warning/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="text-warning size-4" /> Performance Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.performance.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs">
                  <div className="bg-warning mt-1 size-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Binary className="size-4" /> Tech Debt Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.techDebt.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs">
                  <div className="mt-1 size-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
