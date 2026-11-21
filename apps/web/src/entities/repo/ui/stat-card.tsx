import type { ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card } from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";

import { getDeltaColorClass } from "../model/stat-delta";

const TONE_TEXT = {
  danger: "text-destructive",
  default: "",
  success: "text-success",
  warning: "text-warning",
} as const;

const TONE_METER = {
  danger: "bg-destructive",
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
} as const;

type ScoreTone = keyof typeof TONE_TEXT;

type Props = {
  className?: string;
  delta?: number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClass?: string;
  label: string;
  meter?: number;
  reverseColor?: boolean;
  tone?: ScoreTone;
  value: number | string;
};

const SCORE_SUFFIX = "/100";

export function StatCard({
  className,
  delta,
  description,
  icon: Icon,
  iconClass,
  label,
  meter,
  reverseColor,
  tone = "default",
  value,
}: Readonly<Props>) {
  const isPositiveTrend = delta != null && delta > 0;
  const isNegativeTrend = delta != null && delta < 0;

  const stringValue = String(value);
  const hasScoreSuffix = stringValue.endsWith(SCORE_SUFFIX);
  const displayValue = hasScoreSuffix ? stringValue.slice(0, -SCORE_SUFFIX.length) : stringValue;

  return (
    <Card
      className="gap-2.5"
      size="compact"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="truncate text-2xs text-muted-foreground">{label}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn("font-semibold text-metric tabular-nums", TONE_TEXT[tone])}>
              {displayValue}
              {hasScoreSuffix && (
                <span className="font-normal text-muted-foreground text-xs">{SCORE_SUFFIX}</span>
              )}
            </span>

            {delta != null && (
              <AppBadge
                className={getDeltaColorClass(delta, reverseColor === true)}
                variant="outline"
              >
                {isPositiveTrend ? (
                  <ArrowUpRight />
                ) : isNegativeTrend ? (
                  <ArrowDownRight />
                ) : (
                  <Minus />
                )}
                {Math.abs(delta)}%
              </AppBadge>
            )}
          </div>
        </div>

        <div
          className={cn("flex size-7 shrink-0 items-center justify-center rounded-tile", className)}
        >
          <Icon className={cn("size-4", iconClass)} />
        </div>
      </div>

      {meter != null && (
        <Progress
          aria-label={label}
          className="h-1"
          indicatorClassName={TONE_METER[tone]}
          value={meter}
        />
      )}

      <p className="text-muted-foreground text-xs">{description}</p>
    </Card>
  );
}
