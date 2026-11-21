"use client";
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Code2,
  Cpu,
  FileCog,
  Flame,
  GitBranch,
  Laptop,
  Layers,
  Link2Off,
  type LucideIcon,
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
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { activeStatKeys, type FloatingCardStatKey } from "../model/floating-card-stats";

const MARKERS_CONFIG = {
  api: {
    color: "border-none bg-info/10 text-info",
    icon: Terminal,
    markerKey: "marker_api_endpoint" as const,
  },
  client: {
    color: "border-none bg-brand-ai/10 text-brand-ai",
    icon: Laptop,
    markerKey: "marker_client_side" as const,
  },
  config: {
    color: "border-none bg-background/15 text-background",
    icon: Settings,
    markerKey: "marker_config" as const,
  },
  entrypoint: {
    color: "border-none bg-warning/10 text-warning",
    icon: Play,
    markerKey: "marker_entrypoint" as const,
  },
  risk: {
    color: "border-none bg-destructive/10 text-destructive",
    icon: ShieldAlert,
    markerKey: "marker_high_risk" as const,
  },
  server: {
    color: "border-none bg-success/10 text-success",
    icon: Server,
    markerKey: "marker_server_side" as const,
  },
  shared: {
    color: "border-none bg-warning/10 text-warning",
    icon: Layers,
    markerKey: "marker_shared" as const,
  },
} as const;

const STATS_CONFIG = {
  apiCount: { icon: Unplug, statKey: "stats_api_routes" },
  changeCouplingCount: { icon: RefreshCw, statKey: "stats_couplings" },
  churnCount: { icon: GitBranch, statKey: "stats_churns" },
  configCount: { icon: FileCog, statKey: "stats_configs" },
  dependencyHotspotCount: { icon: Network, statKey: "stats_centrality" },
  entrypointCount: { icon: PlayCircle, statKey: "stats_entrypoints" },
  frameworkCount: { icon: Cpu, statKey: "stats_frameworks" },
  graphWarningCount: { icon: AlertCircle, statKey: "stats_unresolved" },
  hotspotCount: { icon: Flame, statKey: "stats_hotspots" },
  orphanCount: { icon: Link2Off, statKey: "stats_orphan" },
  riskCount: { icon: ShieldAlert, isDestructive: true, statKey: "stats_vulnerabilities" },
} as const satisfies Record<
  FloatingCardStatKey,
  { icon: LucideIcon; isDestructive?: boolean; statKey: keyof IntlMessages["Dashboard"] }
>;

type Props = {
  anchorEl: HTMLElement | null;
  hoveredFile: null | string;
  repoId: string;
};

export function RepoFloatingCard({ anchorEl, hoveredFile, repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const { aid } = useRepoParams();
  const [coords, setCoords] = useState<null | { x: number; y: number }>(null);
  const t = useTranslations("Dashboard");

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

  const { data: payload, isLoading } = useQuery(
    trpc.analysis.getStructureNode.queryOptions(
      {
        aid: aid ?? undefined,
        nodeId,
        repoId,
      },
      { enabled: hoveredFile !== null },
    ),
  );

  if (coords == null || hoveredFile == null) {
    return null;
  }

  const node = payload?.node;

  const activeMarkers =
    node != null
      ? Object.entries(node.markers)
          .filter(([, isActive]) => isActive)
          .flatMap(([key]) => (key in MARKERS_CONFIG ? [key as keyof typeof MARKERS_CONFIG] : []))
      : [];

  const activeStats =
    node != null
      ? activeStatKeys(node.stats).map((key) => ({
          config: STATS_CONFIG[key],
          key,
          value: node.stats[key],
        }))
      : [];

  return createPortal(
    <div
      className="fade-in slide-in-from-bottom-2 pointer-events-none z-50 w-85 animate-in rounded-xl border bg-popover p-4"
      style={{
        left: `${coords.x}px`,
        position: "absolute",
        top: `${coords.y}px`,
      }}
    >
      {isLoading || !node ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Skeleton className="size-6" />
              <SkeletonText
                className="min-w-0 flex-1"
                lines={1}
                widths={["w-32"]}
              />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>

          <SkeletonText
            lines={1}
            widths={["w-full"]}
          />

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>

          <div className="flex flex-col gap-2 border-t pt-2.5">
            <SkeletonText
              lines={1}
              widths={["w-32"]}
            />

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
              <Skeleton className="h-9 rounded-none" />
              <Skeleton className="h-9 rounded-none" />
              <Skeleton className="h-9 rounded-none" />
              <Skeleton className="h-9 rounded-none" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <span className="flex max-w-52 items-center gap-1.5 truncate font-bold text-xs">
              <Code2 />
              {node.label}
            </span>
            <AppBadge
              className="text-2xs"
              variant="outline"
            >
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
                    className={cn(
                      "flex select-none items-center gap-1 px-2 py-0.5 font-semibold text-2xs",
                      marker.color,
                    )}
                    key={key}
                    variant="secondary"
                  >
                    <Icon className="size-2.5" />
                    {t(marker.markerKey)}
                  </AppBadge>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-2.5">
            {node.score > 0 && (
              <div className="flex items-center gap-1.5 font-bold text-2xs">
                <AlertTriangle className="size-3" />
                <span>{t("importance_score")}</span>
                <span>{node.score}</span>
              </div>
            )}

            {activeStats.length > 0 && (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border pt-0">
                {activeStats.map(({ config, key, value }) => {
                  const Icon = config.icon;
                  const isDestructive =
                    "isDestructive" in config ? Boolean(config.isDestructive) : false;

                  return (
                    <div
                      className="flex items-center justify-between gap-2 bg-popover p-2.5 font-mono text-2xs"
                      key={key}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <Icon />
                        <span className="truncate">{t(config.statKey)}</span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-bold",
                          isDestructive ? "text-destructive" : "",
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
    document.body,
  );
}
