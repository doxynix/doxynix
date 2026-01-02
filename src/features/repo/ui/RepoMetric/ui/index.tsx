"use client";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { RepoMetricProps } from "@/features/repo/ui/RepoMetric/types";

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
