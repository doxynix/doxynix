"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

type Props = {
  colorClass?: string;
  icon: LucideIcon;
  label: string;
  score: number | null | undefined;
};

export const RepoMetric = ({ colorClass, icon: Icon, label, score }: Props) => {
  const safeScore = score ?? 0;

  return (
    <AppTooltip content={`${label}: ${safeScore}/100`}>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all hover:brightness-110",
          colorClass ?? "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold tabular-nums">{safeScore}</span>
      </div>
    </AppTooltip>
  );
};
