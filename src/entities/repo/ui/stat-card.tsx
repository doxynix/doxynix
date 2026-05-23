import type { ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";

type Props = {
  className?: string;
  delta?: number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClass?: string;
  label: string;
  reverseColor?: boolean;
  value: number | string;
};

export function StatCard({
  className,
  delta,
  description,
  icon: Icon,
  iconClass,
  label,
  reverseColor,
  value,
}: Readonly<Props>) {
  const isPositiveTrend = delta != null && delta > 0;
  const isNegativeTrend = delta != null && delta < 0;

  const getDeltaClass = () => {
    if (delta == null || delta === 0) return "text-muted-foreground";

    if (reverseColor === true) {
      return isPositiveTrend ? "text-destructive" : "text-success";
    }

    return isPositiveTrend ? "text-success" : "text-destructive";
  };

  return (
    <Card className="hover:border-border-strong transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className={cn("rounded-full p-2", className)}>
          <Icon className={iconClass} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold">{value}</p>

          {delta != null && (
            <AppBadge variant="outline" className={getDeltaClass()}>
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
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
