"use client";

import type { ComponentType, CSSProperties } from "react";
import { useLocale } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

type Props = {
  className?: string;
  color?: string;
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
  label: null | number | string | undefined;
  showLabel?: boolean;
  tooltip?: string;
};

export function RepoGitMetric({
  className,
  color,
  icon: Icon,
  label,
  showLabel = false,
  tooltip,
}: Readonly<Props>) {
  const locale = useLocale();
  if (label == null || label === "") {
    return null;
  }

  const isCssValue = (color?.startsWith("#") ?? false) || color?.startsWith("var(");

  const iconNode = Icon ? (
    <Icon
      className={cn("size-3.5 shrink-0", !(isCssValue ?? false) && color)}
      style={
        (isCssValue ?? false)
          ? {
              color: color,
              fill: color,
            }
          : undefined
      }
    />
  ) : null;

  if (showLabel) {
    return (
      <div className={cn("flex min-w-0 items-center gap-1.5 text-xs", className)}>
        {iconNode}
        <span className="truncate text-muted-foreground">{tooltip}</span>
        <span className="ml-auto truncate font-medium text-foreground">
          {label.toLocaleString(locale)}
        </span>
      </div>
    );
  }

  return (
    <AppTooltip content={tooltip}>
      <div className={cn("flex items-center gap-1", className)}>
        {iconNode}
        <span className="leading-tight">{label.toLocaleString(locale)}</span>
      </div>
    </AppTooltip>
  );
}
