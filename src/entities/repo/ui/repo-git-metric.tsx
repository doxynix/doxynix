"use client";

import type { ComponentType, CSSProperties } from "react";
import { useLocale } from "next-intl";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

type Props = {
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
  label: string | number | null | undefined;
  tooltip?: string;
  color?: string;
  className?: string;
};

export function RepoGitMetric({ icon: Icon, label, tooltip, color, className }: Props) {
  const locale = useLocale();
  if (label == null || label === "") return null;
  const isCssValue = (color?.startsWith("#") ?? false) || color?.startsWith("var(");

  return (
    <AppTooltip content={tooltip}>
      <div className={cn("flex cursor-help items-center gap-1", className)}>
        {Icon && (
          <Icon
            className={cn("h-3 w-3", !(isCssValue ?? false) && color)}
            style={
              (isCssValue ?? false)
                ? {
                    color: color,
                    fill: color,
                  }
                : undefined
            }
          />
        )}
        <span className="leading-tight">{label.toLocaleString(locale)}</span>
      </div>
    </AppTooltip>
  );
}
