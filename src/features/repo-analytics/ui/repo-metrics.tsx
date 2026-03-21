"use client";

import { AlertTriangle, Binary, CheckCircle2, Construction, ShieldAlert, Zap } from "lucide-react";

import type { RepoMetricsItem } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = { data: RepoMetricsItem };

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
          <CardContent className="text-muted-foreground text-sm leading-relaxed">
            {data?.dataFlow}
          </CardContent>
        </Card>

        <Card className="border-error/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="text-error size-5" /> Security
              </CardTitle>
            </div>
            <div className="text-error text-2xl font-black">{data?.security.score}/10</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.security.risks.map((item) => (
                <div key={item} className="flex gap-2 text-xs">
                  <AlertTriangle className="text-warning size-3.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Construction className="text-warning size-5" /> Refactoring Targets
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {data?.refactoringTargets.map((item) => (
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
          ))}
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
              {data?.performance.map((item) => (
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
              {data?.techDebt.map((item) => (
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
