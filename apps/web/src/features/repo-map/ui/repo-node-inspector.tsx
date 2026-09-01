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

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { ScrollArea } from "@/shared/ui/core/scroll-area";

import type { RepoNodeContext } from "@/entities/repo/model/repo.types";

type Props = {
  data: NonNullable<RepoNodeContext>;
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
    .filter(([_, value]) => value)
    .map(([key]) => key);

  const allFileReferences = Array.from(
    new Set([...node.previewPaths, ...inspect.samplePaths, ...explain.sourcePaths]),
  )
    .map((path) => path.split("/").pop())
    .filter((name) => name !== node.label);

  const childIds = new Set(children.map((c) => c.id));

  const uniqueNavigation = explain.nextSuggestedPaths.filter(
    (path) => path !== node.id && !childIds.has(path),
  );

  const uniqueRelated = inspect.relatedPaths.filter(
    (path) => path !== node.id && !childIds.has(path),
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
    },
  );

  const activeStats = [
    {
      icon: <Activity className="text-foreground" />,
      label: "Files",
      value: stats.pathCount,
    },
    { icon: <Zap className="text-destructive" />, label: "Risks", value: stats.riskCount },
    { icon: <Compass className="text-success" />, label: "APIs", value: stats.apiCount },
    {
      icon: <Layers className="text-warning" />,
      label: "Coupling",
      value: stats.changeCouplingCount,
    },
    {
      icon: <ShieldCheck className="text-warning" />,
      label: "Warnings",
      value: stats.graphWarningCount,
    },
    {
      icon: <Activity className="text-pink-400" />,
      label: "Churn",
      value: stats.churnCount,
    },
    {
      icon: <Target className="text-destructive" />,
      label: "Hotspots",
      value: stats.hotspotCount,
    },
    {
      icon: <FileText className="text-blue" />,
      label: "Configs",
      value: stats.configCount,
    },
    {
      icon: <Zap className="text-purple-400" />,
      label: "Dep Risks",
      value: stats.dependencyHotspotCount,
    },
    {
      icon: <ArrowRight className="text-success" />,
      label: "Entries",
      value: stats.entrypointCount,
    },
    {
      icon: <Boxes className="text-cyan-400" />,
      label: "Frameworks",
      value: stats.frameworkCount,
    },
    {
      icon: <FileSearch className="text-gray-400" />,
      label: "Orphans",
      value: stats.orphanCount,
    },
    {
      icon: <GitBranch className="text-purple-400" />,
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
            <AppBadge className="text-xs" variant="outline">
              {node.kind}
            </AppBadge>
            <AppBadge className="text-xs" variant="outline">
              {node.score}
            </AppBadge>
          </div>
          {activeMarkers.map((marker) => (
            <AppBadge className="text-xs" key={marker} variant="outline">
              {marker}
            </AppBadge>
          ))}
        </div>
        <AppButton
          aria-label="Close node inspector"
          className="shrink-0"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X />
        </AppButton>
      </div>

      <ScrollArea>
        <div className="flex flex-col gap-8 p-4">
          {explain.whyImportant && (
            <section className="flex flex-col gap-2">
              <div className="text-xs">Business Impact</div>
              <p className="border-primary pl-3 text-xs italic">
                &quot;{explain.whyImportant}&quot;
              </p>
            </section>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl p-3">
              <ShieldCheck className="size-5 text-warning" />
              <p className="text-warning text-xs">{explain.relationships.reviewPriority?.reason}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="text-sm">Inferred Role</div>
                <p className="text-xs">{explain.role}</p>
              </div>
              <AppBadge className="text-success text-xs" variant="outline">
                {explain.confidence}
              </AppBadge>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {explain.relationships.riskTitles.map((title) => (
              <AppBadge className="text-[10px]" key={title} variant="destructive">
                {title}
              </AppBadge>
            ))}
            {explain.relationships.factTitles.map((fact) => (
              <AppBadge className="text-[10px]" key={fact} variant="secondary">
                {fact}
              </AppBadge>
            ))}
          </div>

          {activeStats.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {activeStats.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="flex flex-col items-center justify-center gap-1 p-0">
                    <div className="flex items-center gap-1">
                      {stat.icon}
                      <span className="font-bold text-sm">{stat.value}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{stat.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Compass /> Synthesis
            </div>
            <div className="flex flex-col gap-3">
              {explain.summary.map((line: string, i: number) => (
                <div className="group flex gap-3 text-muted-foreground text-xs" key={i}>
                  <div className="size-1 shrink-0 rounded-full" />
                  {line}
                </div>
              ))}
            </div>
          </div>

          {(children.length > 0 || allFileReferences.length > 0) && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Boxes /> Module Composition
              </div>

              {children.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {children.map((child) => (
                    <AppButton
                      key={child.id}
                      onClick={() => {
                        onNavigate(child.path);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <FileIcon /> {child.label}
                    </AppButton>
                  ))}
                </div>
              )}
            </section>
          )}

          {connections.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1 text-xs">
                <Compass /> Explore Connections
              </div>
              <div className="flex flex-col gap-1">
                {connections.map((path) => (
                  <AppButton
                    className="justify-between"
                    key={path}
                    onClick={() => {
                      onNavigate(path);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <span className="truncate">{path.split("/").pop()}</span>
                    <ArrowRight />
                  </AppButton>
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
                      <div className="flex flex-col gap-1 rounded border p-2" key={bucket}>
                        <div className="text-[10px] text-muted-foreground">{bucket}</div>
                        <div className="text-xs">{paths.length} related modules</div>
                      </div>
                    ),
                )}
              </div>
            </section>
          )}

          {inspect.recommendedActions.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="text-warning text-xs">Recommended Actions</div>
              <div className="flex flex-col gap-2">
                {inspect.recommendedActions.map((action, i) => (
                  <div
                    className="flex gap-2 rounded-md border border-amber-500/10 bg-amber-500/5 p-2 text-xs"
                    key={i}
                  >
                    <Zap className="mt-0.5 text-amber-500" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.related.docs.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="text-xs">Related Docs</div>
              <div className="flex flex-wrap gap-2">
                {data.related.docs.map((doc) => (
                  <AppBadge className="text-[10px]" key={doc.id} variant="secondary">
                    {doc.docType}: {doc.title}
                  </AppBadge>
                ))}
              </div>
            </section>
          )}

          {data.related.findings.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="text-xs">Recent PR Findings</div>
              <div className="flex flex-col gap-2">
                {data.related.findings.slice(0, 4).map((finding) => (
                  <div className="rounded-md border p-2 text-xs" key={finding.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium">
                        PR #{finding.prNumber} · {finding.findingType}
                      </span>
                      <AppBadge variant="outline">{finding.filePath.split("/").pop()}</AppBadge>
                    </div>
                    <p className="line-clamp-3 text-muted-foreground">{finding.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-md border bg-muted p-2">
              <div className="text-muted-foreground text-xs">Depends On</div>
              <div className="font-bold text-xs">{inspect.dependsOn.length} modules</div>
            </div>
            <div className="flex flex-col gap-1 rounded-md border bg-muted p-2">
              <div className="text-muted-foreground text-xs">Used By</div>
              <div className="font-bold text-xs">{inspect.usedBy.length} consumers</div>
            </div>
          </div>

          {allHints.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted p-4">
              <div className="flex items-center gap-2 font-bold text-warning text-xs">
                <Lightbulb /> Technical Context
              </div>
              <div className="flex flex-col gap-3">
                {allHints.map((hint, i) => (
                  <p className="text-muted-foreground text-xs" key={i}>
                    {hint}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {availableActions.canQuickAudit && (
              <AppButton className="w-full gap-2">
                <FileSearch /> Start Quick Audit
              </AppButton>
            )}
            {availableActions.canDocumentFile && (
              <AppButton className="w-full gap-2" variant="outline">
                <SearchCode /> Document Logic
              </AppButton>
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
