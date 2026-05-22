"use client";

import { useLayoutEffect, useState } from "react";
import { AlertTriangle, Code2, ShieldAlert } from "lucide-react";
import { createPortal } from "react-dom";

import { trpc } from "@/shared/api/trpc";
import { AppBadge } from "@/shared/ui/core/badge";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

type Props = {
  anchorEl: HTMLElement | null;
  hoveredFile: null | string;
  repoId: string;
};

export function FloatingFileCard({ anchorEl, hoveredFile, repoId }: Readonly<Props>) {
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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoords({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY + 25,
    });
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

  return createPortal(
    <div
      className="bg-popover animate-in fade-in slide-in-from-bottom-2 pointer-events-none z-50 w-85 rounded-xl border p-4 shadow-2xl duration-300"
      style={{
        left: `${coords.x}px`,
        position: "absolute",
        top: `${coords.y}px`,
      }}
    >
      {isLoading || !node ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <span className="text-foreground flex max-w-50 items-center gap-1.5 truncate font-mono text-xs font-bold">
              <Code2 className="text-muted-foreground size-3.5" />
              {node.label}
            </span>
            <AppBadge variant="outline" className="font-mono text-[10px] uppercase">
              {node.kind}
            </AppBadge>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {node.description.replace(`${node.path}: `, "")}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {node.markers.entrypoint && (
              <AppBadge
                variant="secondary"
                className="border-none bg-emerald-500/10 text-[9px] text-emerald-500"
              >
                Entrypoint
              </AppBadge>
            )}
            {node.markers.api && (
              <AppBadge
                variant="secondary"
                className="border-none bg-blue-500/10 text-[9px] text-blue-500"
              >
                API Endpoint
              </AppBadge>
            )}
            {node.markers.risk && (
              <AppBadge
                variant="secondary"
                className="bg-destructive/10 text-destructive flex items-center gap-1 border-none text-[9px]"
              >
                <ShieldAlert className="size-2.5" /> High Risk
              </AppBadge>
            )}
          </div>

          <div className="text-muted-foreground/80 flex items-center gap-4 border-t pt-2.5 font-mono text-[10px] font-semibold">
            {node.stats.riskCount > 0 && (
              <span className="text-destructive flex items-center gap-0.5">
                <AlertTriangle className="size-2.5" /> Risks: {node.stats.riskCount}
              </span>
            )}
            {node.stats.churnCount > 0 && (
              <span>
                Churns: <strong className="text-foreground">{node.stats.churnCount}</strong>
              </span>
            )}
            {node.stats.hotspotCount > 0 && (
              <span>
                Hotspots: <strong className="text-foreground">{node.stats.hotspotCount}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
