import { ComponentType } from "react";

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
  if (label == null || label === "") return null;

  return (
    <AppTooltip content={tooltip}>
      <div className={cn("flex cursor-help items-center gap-1", className)}>
        {Icon && <Icon className={cn("h-3 w-3", color)} />}
        <span>{label.toLocaleString("ru-RU")}</span>
      </div>
    </AppTooltip>
  );
}
