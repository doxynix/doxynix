"use client";

import { ComponentType } from "react";
import { useLocale } from "next-intl";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

type Props = {
  icon?: ComponentType<{ className?: string }>;
  label: string | number | null | undefined;
  tooltip?: string;
  color?: string;
  className?: string;
};

export function RepoMetric({ icon: Icon, label, tooltip, color, className }: Props) {
  const locale = useLocale();
  if (label == null || label === "") return null;

  return (
    <AppTooltip content={tooltip}>
      <div className={cn("flex cursor-help items-center gap-1", className)}>
        {Icon && <Icon className={cn("h-3 w-3", color)} />}
        <span>{label.toLocaleString(locale)}</span>
      </div>
    </AppTooltip>
  );
}
