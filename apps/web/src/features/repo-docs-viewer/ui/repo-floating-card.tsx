"use client";

import { useLayoutEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Code2,
  Cpu,
  Flame,
  GitBranch,
  Laptop,
  Layers,
  Link2Off,
  Network,
  Play,
  PlayCircle,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  Terminal,
  Unplug,
} from "lucide-react";
import { createPortal } from "react-dom";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

const MARKERS_CONFIG = {
  api: {
    color: "border-none bg-blue-500/10 text-blue-500",
    icon: Terminal,
    label: "API Endpoint",
  },
  client: {
    color: "border-none bg-violet-500/10 text-violet-400",
    icon: Laptop,
    label: "Client-Side",
  },
  config: {
    color: "border-none bg-background/15 text-background",
    icon: Settings,
    label: "Config",
  },
  entrypoint: {
    color: "border-none bg-amber-500/10 text-amber-500",
    icon: Play,
    label: "Entrypoint",
  },
  risk: {
    color: "border-none bg-destructive/10 text-destructive",
    icon: ShieldAlert,
    label: "High Risk",
  },
  server: {
    color: "border-none bg-emerald-500/10 text-emerald-400",
    icon: Server,
    label: "Server-Side",
  },
  shared: {
    color: "border-none bg-orange-500/10 text-orange-400",
    icon: Layers,
    label: "Shared",
  },
} as const;

const STATS_CONFIG = {
  apiCount: { icon: Unplug, label: "API Routes" },
  changeCouplingCount: { icon: RefreshCw, label: "Couplings" },
  churnCount: { icon: GitBranch, label: "Churns" },
  dependencyHotspotCount: { icon: Network, label: "Centrality" },
  entrypointCount: { icon: PlayCircle, label: "Entrypoints" },
  frameworkCount: { icon: Cpu, label: "Frameworks" },
  graphWarningCount: { icon: AlertCircle, label: "Unresolved" },
  hotspotCount: { icon: Flame, label: "Hotspots" },
  orphanCount: { icon: Link2Off, label: "Orphan" },
  riskCount: { icon: ShieldAlert, isDestructive: true, label: "Vulnerabilities" },
} as const;

type Props = {
  anchorEl: HTMLElement | null;
  hoveredFile: null | string;
  repoId: string;
};

export function RepoFloatingCard({ anchorEl, hoveredFile, repoId }: Readonly<Props>) {
  const { aid } = useRepoParams();
  const [coords, setCoords] = useState<null | { x: number; y: number }>(null);

  if ((anchorEl == null || hoveredFile == null) && coords !== null) {
    setCoords(null);
  }

  useLayoutEffect(() => {
    if (anchorEl == null || hoveredFile == null) {
      return;
    }

    const rect = anchorEl.getBoundingClientRect();

    const handle = requestAnimationFrame(() => {
      setCoords({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY + 25,
      });
    });

    return () => cancelAnimationFrame(handle);
  }, [anchorEl, hoveredFile]);

  const nodeId = hoveredFile != null ? `file:${hoveredFile}` : "";

  const { data: payload, isLoading } = trpc.analysis.getStructureNode.useQuery(
    {
      aid: aid ?? undefined,
      nodeId,
      repoId,
    },
    { enabled: hoveredFile !== null }
  );

  if (coords == null || hoveredFile == null) return null;

  const node = payload?.node;

  const activeMarkers =
    node != null
      ? Object.entries(node.markers)
          .filter(([_, isActive]) => isActive === true)
          .map(([key]) => key as keyof typeof MARKERS_CONFIG)
      : [];

  const activeStats =
    node != null
      ? Object.entries(node.stats)
          .filter(([key, value]) => typeof value === "number" && value > 0 && key !== "pathCount")
          .map(([key, value]) => ({
            config: STATS_CONFIG[key as keyof typeof STATS_CONFIG],
            key,
            value: value as number,
          }))
      : [];

  return createPortal(
    <div
      className="bg-popover animate-in fade-in slide-in-from-bottom-2 pointer-events-none z-50 w-85 rounded-xl border p-4"
      style={{
        left: `${coords.x}px`,
        position: "absolute",
        top: `${coords.y}px`,
      }}
    >
      {isLoading || !node ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="flex gap-3 border-t pt-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <span className="flex max-w-52 items-center gap-1.5 truncate text-xs font-bold">
              <Code2 />
              {node.label}
            </span>
            <AppBadge variant="outline" className="text-[10px] uppercase">
              {node.kind}
            </AppBadge>
          </div>

          <p className="text-xs">{node.description.replace(`${node.path}: `, "")}</p>

          {activeMarkers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {activeMarkers.map((key) => {
                const marker = MARKERS_CONFIG[key];
                const Icon = marker.icon;
                return (
                  <AppBadge
                    key={key}
                    variant="secondary"
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold select-none",
                      marker.color
                    )}
                  >
                    <Icon className="size-2.5" />
                    {marker.label}
                  </AppBadge>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-2.5">
            {node.score > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <AlertTriangle className="size-3" />
                <span>Importance Score:</span>
                <span>{node.score}</span>
              </div>
            )}

            {activeStats.length > 0 && (
              <div className="bg-border border-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border pt-0">
                {activeStats.map(({ config, key, value }) => {
                  const Icon = config.icon;
                  const isDestructive =
                    "isDestructive" in config ? Boolean(config.isDestructive) : false;

                  return (
                    <div
                      key={key}
                      className="bg-popover flex items-center justify-between gap-2 p-2.5 font-mono text-[10px]"
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <Icon />
                        <span className="truncate">{config.label}:</span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-bold",
                          isDestructive ? "text-destructive" : ""
                        )}
                      >
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
