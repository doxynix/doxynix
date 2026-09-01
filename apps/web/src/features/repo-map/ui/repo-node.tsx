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

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";

import type { RepoMapNodeData } from "../model/repo-map-types";

type Props = NodeProps<Node<RepoMapNodeData, "repoNode">>;

export const RepoNode = ({ data }: Props) => {
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
    { color: "text-blue", icon: Globe, id: "api", show: stats.apiCount > 0, val: stats.apiCount },
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
      color: "text-orange-600",
      icon: Flame,
      id: "hot",
      show: stats.hotspotCount > 0,
      val: stats.hotspotCount,
    },
    {
      color: "text-purple-400",
      icon: Zap,
      id: "coupling",
      show: stats.dependencyHotspotCount > 0,
      val: stats.dependencyHotspotCount,
    },
    {
      color: "text-orange-400",
      icon: Layers,
      id: "coupled",
      show: stats.changeCouplingCount > 0,
      val: stats.changeCouplingCount,
    },
    {
      color: "text-emerald-400",
      icon: ArrowRightCircle,
      id: "entry",
      show: stats.entrypointCount > 0,
      val: stats.entrypointCount,
    },
    {
      color: "text-amber-500",
      icon: AlertTriangle,
      id: "warns",
      show: stats.graphWarningCount > 0,
      val: stats.graphWarningCount,
    },
    {
      color: "text-slate-400",
      icon: Settings2,
      id: "configs",
      show: stats.configCount > 0,
      val: stats.configCount,
    },
    {
      color: "text-gray-400",
      icon: FileQuestion,
      id: "orphans",
      show: stats.orphanCount > 0,
      val: stats.orphanCount,
    },
    {
      color: "text-indigo-400",
      icon: Boxes,
      id: "logic",
      show: stats.frameworkCount > 0,
      val: stats.frameworkCount,
    },
  ] as const;

  return (
    <div
      className={cn(
        "group relative transition-opacity duration-300 ease-in-out",
        dimByFilter || dimByHover || dimBySearch ? "z-1 opacity-50" : "z-10 opacity-100",
      )}
    >
      <Handle className="cursor-grab! opacity-0" position={Position.Top} type="target" />

      <Card className="w-96">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isGroup ? <Folder className="fill-current" /> : <File />}
            <span className="flex-1 truncate font-bold text-xs">{label}</span>
            <AppBadge variant="outline">{data.kind}</AppBadge>
          </CardTitle>
          <p className="text-muted-foreground text-xs">{description}</p>
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-2">
          {metricsConfig.map(
            (m) =>
              m.show && (
                <AppBadge key={m.id} variant="outline">
                  <m.icon className={cn(m.color)} />
                  <div className="flex gap-1 text-muted-foreground">
                    <span className="text-[10px]">{m.val}</span>
                    <span className="text-[10px]">{m.id}</span>
                  </div>
                </AppBadge>
              ),
          )}

          {data.score > 0 && (
            <div className="col-span-2 mt-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Complexity Score</span>
                <span>{data.score}</span>
              </div>
              <Progress
                indicatorClassName={data.score > 200 ? "bg-destructive" : "bg-foreground"}
                value={data.score / 5}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Handle className="cursor-grab! opacity-0" position={Position.Bottom} type="source" />
    </div>
  );
};
