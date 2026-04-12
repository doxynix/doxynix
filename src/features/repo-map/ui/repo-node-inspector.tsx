import {
  Activity,
  ArrowRight,
  Boxes,
  Compass,
  FileIcon,
  FileSearch,
  FileText,
  GitBranch,
  Layers,
  Lightbulb,
  SearchCode,
  ShieldCheck,
  Target,
  X,
  Zap,
} from "lucide-react";

import type { NodeBrief } from "@/shared/api/trpc";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { ScrollArea } from "@/shared/ui/core/scroll-area";

type Props = {
  data: NodeBrief;
  onClose: () => void;
  onNavigate: (id: null | string) => void;
};

export function RepoNodeInspector({ data, onClose, onNavigate }: Readonly<Props>) {
  const { availableActions, children, explain, inspect, node } = data;
  const stats = node.stats as Record<string, number>;

  const allHints = [
    ...inspect.apiHints,
    ...inspect.graphHints,
    ...inspect.gitHints,
    ...inspect.hotspotHints,
    ...inspect.configHints,
    ...(inspect.entrypointReason != null
      ? [`Entrypoint context: ${inspect.entrypointReason}`]
      : []),
  ];

  const activeMarkers = Object.entries(node.markers)
    .filter(([_, value]) => value === true)
    .map(([key]) => key);

  const allFileReferences = Array.from(
    new Set([...node.previewPaths, ...inspect.samplePaths, ...explain.sourcePaths])
  )
    .map((path) => path.split("/").pop())
    .filter((name) => name !== node.label);

  const childIds = new Set(children.map((c) => c.id));

  const uniqueNavigation = explain.nextSuggestedPaths.filter(
    (path) => path !== node.id && !childIds.has(path)
  );

  const uniqueRelated = inspect.relatedPaths.filter(
    (path) => path !== node.id && !childIds.has(path)
  );

  const internalFileNames = new Set(allFileReferences);

  const connections = Array.from(new Set([...uniqueNavigation, ...uniqueRelated])).filter(
    (path) => {
      const fileName = path.split("/").pop();

      const isSelfId = path === node.id;
      const isSelfPath = path === node.path;
      const isSelfName = fileName === node.label;
      const isInternal = internalFileNames.has(fileName);

      return !isSelfId && !isSelfPath && !isSelfName && !isInternal;
    }
  );

  const activeStats = [
    {
      icon: <Activity className="text-foreground size-4" />,
      label: "Files",
      value: stats.pathCount,
    },
    { icon: <Zap className="text-destructive size-4" />, label: "Risks", value: stats.riskCount },
    { icon: <Compass className="text-success size-4" />, label: "APIs", value: stats.apiCount },
    {
      icon: <Layers className="text-warning size-4" />,
      label: "Coupling",
      value: stats.changeCouplingCount,
    },
    {
      icon: <ShieldCheck className="text-warning size-4" />,
      label: "Warnings",
      value: stats.graphWarningCount,
    },
    {
      icon: <Activity className="size-4 text-pink-400" />,
      label: "Churn",
      value: stats.churnCount,
    },
    {
      icon: <Target className="text-destructive size-4" />,
      label: "Hotspots",
      value: stats.hotspotCount,
    },
    {
      icon: <FileText className="text-blue size-4" />,
      label: "Configs",
      value: stats.configCount,
    },
    {
      icon: <Zap className="size-4 text-purple-400" />,
      label: "Dep Risks",
      value: stats.dependencyHotspotCount,
    },
    {
      icon: <ArrowRight className="text-success size-4" />,
      label: "Entries",
      value: stats.entrypointCount,
    },
    {
      icon: <Boxes className="size-4 text-cyan-400" />,
      label: "Frameworks",
      value: stats.frameworkCount,
    },
    {
      icon: <FileSearch className="size-4 text-gray-400" />,
      label: "Orphans",
      value: stats.orphanCount,
    },
    {
      icon: <GitBranch className="size-4 text-purple-400" />,
      label: "Deps",
      value: explain.relationships.dependsOn.length,
    },
  ].filter((stat) => stat.value != null && stat.value > 0);

  return (
    <>
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm">{node.label}</h3>
            <Badge variant="outline" className="text-xs">
              {node.kind}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {node.score}
            </Badge>
          </div>
          {activeMarkers.map((marker) => (
            <Badge key={marker} variant="outline" className="text-xs">
              {marker}
            </Badge>
          ))}
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="shrink-0">
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea>
        <div className="flex flex-col gap-8 p-4">
          {explain.whyImportant && (
            <section className="space-y-2">
              <div className="text-xs">Business Impact</div>
              <p className="border-primary pl-3 text-xs italic">
                &quot;{explain.whyImportant}&quot;
              </p>
            </section>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl p-3">
              <ShieldCheck className="text-warning size-5 shrink-0" />
              <p className="text-warning text-xs">{explain.relationships.reviewPriority?.reason}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="text-sm">Inferred Role</div>
                <p className="text-xs">{explain.role}</p>
              </div>
              <Badge variant="outline" className="text-success text-xs">
                {explain.confidence}
              </Badge>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {explain.relationships.riskTitles.map((title) => (
              <Badge key={title} variant="destructive" className="text-[10px]">
                {title}
              </Badge>
            ))}
            {explain.relationships.factTitles.map((fact) => (
              <Badge key={fact} variant="secondary" className="text-[10px]">
                {fact}
              </Badge>
            ))}
          </div>

          {activeStats.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {activeStats.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="flex flex-col items-center justify-center gap-1 p-0">
                    <div className="flex items-center gap-1">
                      {stat.icon}
                      <span className="text-sm font-bold">{stat.value}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{stat.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Compass className="size-4" /> Synthesis
            </div>
            <div className="flex flex-col gap-3">
              {explain.summary.map((line: string, i: number) => (
                <div key={i} className="text-muted-foreground group flex gap-3 text-xs">
                  <div className="size-1 shrink-0 rounded-full" />
                  {line}
                </div>
              ))}
            </div>
          </div>

          {(children.length > 0 || allFileReferences.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <Boxes className="size-4" /> Module Composition
              </div>

              {children.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {children.map((child) => (
                    <Button
                      key={child.id}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onNavigate(child.path);
                      }}
                    >
                      <FileIcon className="size-4" /> {child.label}
                    </Button>
                  ))}
                </div>
              )}
            </section>
          )}

          {connections.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1 text-xs">
                <Compass className="size-4" /> Explore Connections
              </div>
              <div className="flex flex-col gap-1">
                {connections.map((path) => (
                  <Button
                    key={path}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onNavigate(path);
                    }}
                    className="justify-between"
                  >
                    <span className="truncate">{path.split("/").pop()}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {inspect.neighborBuckets && Object.keys(inspect.neighborBuckets).length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="text-xs">Architectural Neighbors</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(inspect.neighborBuckets).map(
                  ([bucket, paths]) =>
                    paths.length > 0 && (
                      <div key={bucket} className="flex flex-col gap-1 rounded border p-2">
                        <div className="text-muted-foreground text-[10px]">{bucket}</div>
                        <div className="text-xs">{paths.length} related modules</div>
                      </div>
                    )
                )}
              </div>
            </section>
          )}

          {inspect.recommendedActions.length > 0 && (
            <section className="space-y-3">
              <div className="text-warning text-xs">Recommended Actions</div>
              <div className="space-y-2">
                {inspect.recommendedActions.map((action, i) => (
                  <div
                    key={i}
                    className="flex gap-2 rounded-md border border-amber-500/10 bg-amber-500/5 p-2 text-xs"
                  >
                    <Zap className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/5 flex flex-col gap-1 rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Depends On</div>
              <div className="text-xs font-bold">{inspect.dependsOn.length} modules</div>
            </div>
            <div className="bg-muted/5 flex flex-col gap-1 rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Used By</div>
              <div className="text-xs font-bold">{inspect.usedBy.length} consumers</div>
            </div>
          </div>

          {allHints.length > 0 && (
            <div className="bg-muted/5 flex flex-col gap-3 rounded-xl border p-4">
              <div className="text-warning flex items-center gap-2 text-xs font-bold">
                <Lightbulb className="size-4" /> Technical Context
              </div>
              <div className="flex flex-col gap-3">
                {allHints.map((hint, i) => (
                  <p key={i} className="text-muted-foreground text-xs">
                    {hint}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {availableActions.canQuickAudit && (
              <Button className="w-full gap-2">
                <FileSearch className="size-4" /> Start Quick Audit
              </Button>
            )}
            {availableActions.canDocumentFile && (
              <Button variant="outline" className="w-full gap-2">
                <SearchCode className="size-4" /> Document Logic
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
