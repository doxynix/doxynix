"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  Activity,
  AlertTriangle,
  ArrowRightCircle,
  Boxes,
  File,
  FileQuestion,
  FileStack,
  Flame,
  Folder,
  Globe,
  Layers,
  Settings2,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";

import type { RepoMapNodeData } from "../model/repo-map.types";

type Props = NodeProps<Node<RepoMapNodeData, "repoNode">>;

export const RepoNode = ({ data }: Props) => {
  const t = useTranslations("Dashboard");
  const dimByHover = data.repoMap?.dimByHover ?? false;
  const dimByFilter = data.repoMap?.dimByFilter ?? false;
  const dimBySearch = data.repoMap?.dimBySearch ?? false;

  const isGroup = data.nodeType === "group";
  const { description, label, stats } = data;

  const metricsConfig = [
    {
      color: "text-muted-foreground",
      icon: FileStack,
      id: "files",
      show: isGroup,
      val: stats.pathCount,
    },
    { color: "text-info", icon: Globe, id: "api", show: stats.apiCount > 0, val: stats.apiCount },
    {
      color: "text-destructive",
      icon: ShieldAlert,
      id: "risks",
      show: stats.riskCount > 0,
      val: stats.riskCount,
    },
    {
      color: "text-warning",
      icon: Activity,
      id: "churn",
      show: stats.churnCount > 0,
      val: stats.churnCount,
    },
    {
      color: "text-warning",
      icon: Flame,
      id: "hot",
      show: stats.hotspotCount > 0,
      val: stats.hotspotCount,
    },
    {
      color: "text-brand-ai",
      icon: Zap,
      id: "coupling",
      show: stats.dependencyHotspotCount > 0,
      val: stats.dependencyHotspotCount,
    },
    {
      color: "text-warning",
      icon: Layers,
      id: "coupled",
      show: stats.changeCouplingCount > 0,
      val: stats.changeCouplingCount,
    },
    {
      color: "text-success",
      icon: ArrowRightCircle,
      id: "entry",
      show: stats.entrypointCount > 0,
      val: stats.entrypointCount,
    },
    {
      color: "text-warning",
      icon: AlertTriangle,
      id: "warns",
      show: stats.graphWarningCount > 0,
      val: stats.graphWarningCount,
    },
    {
      color: "text-muted-foreground",
      icon: Settings2,
      id: "configs",
      show: stats.configCount > 0,
      val: stats.configCount,
    },
    {
      color: "text-muted-foreground",
      icon: FileQuestion,
      id: "orphans",
      show: stats.orphanCount > 0,
      val: stats.orphanCount,
    },
    {
      color: "text-brand-ai",
      icon: Boxes,
      id: "logic",
      show: stats.frameworkCount > 0,
      val: stats.frameworkCount,
    },
  ] as const;

  return (
    <div
      className={cn(
        "group relative transition-opacity duration-150 ease-out",
        dimByFilter || dimByHover || dimBySearch ? "z-0 opacity-50" : "z-10 opacity-100",
      )}
    >
      <Handle
        className="cursor-grab! opacity-0"
        position={Position.Top}
        type="target"
      />

      <Card
        className="w-64 gap-2.5 p-3"
        size="compact"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-tile bg-surface-hover text-muted-foreground">
            {isGroup ? <Folder className="fill-current" /> : <File />}
          </span>

          <p className="min-w-0 flex-1 truncate font-medium text-sm">{label}</p>

          <AppBadge variant="outline">{data.kind}</AppBadge>
        </div>

        <p className="line-clamp-1 text-2xs text-muted-foreground">{description}</p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
          {metricsConfig
            .filter((metric) => metric.show)
            .slice(0, 4)
            .map((metric) => (
              <span
                className="flex items-center gap-1"
                key={metric.id}
              >
                <metric.icon className={cn("size-3", metric.color)} />
                {metric.val}
              </span>
            ))}
        </div>

        {data.score > 0 && (
          <div>
            <div className="flex justify-between text-2xs text-muted-foreground">
              <span>{t("complexity_score")}</span>
              <span>{data.score}</span>
            </div>

            <Progress
              className="mt-1 h-1"
              indicatorClassName={data.score > 200 ? "bg-destructive-fill" : "bg-foreground"}
              value={data.score / 5}
            />
          </div>
        )}
      </Card>
      <Handle
        className="cursor-grab! opacity-0"
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
};
