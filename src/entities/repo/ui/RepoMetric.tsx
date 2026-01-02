"use client";

import { LucideIcon } from "lucide-react";
import { IconType } from "react-icons/lib";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";

export type RepoMetricProps = {
  icon: LucideIcon | IconType;
  label: string | number | null | undefined;
  tooltip?: string;
  color?: string;
  className?: string;
};

export function RepoMetric({ icon: Icon, label, tooltip, color, className }: RepoMetricProps) {
  if (label == null || label === "") return null;

  return (
    <AppTooltip content={tooltip}>
      <div className={cn("flex cursor-help items-center gap-1", className)}>
        {Icon !== null && <Icon className="h-3 w-3" {...(color != null ? { color } : {})} />}
        <span>{label.toLocaleString("ru-RU")}</span>
      </div>
    </AppTooltip>
  );
}
