import type { ReactNode } from "react";

import { Card } from "@/shared/ui/core/card";
import { StatusBadge } from "@/shared/ui/kit/status-badge";

type StatusTone = "muted" | "success" | "warning";

type Props = {
  action: ReactNode;
  description: string;
  icon: ReactNode;
  status?: string;
  statusTone?: StatusTone;
  title: string;
  variant?: "row" | "tile";
};

export function ConnectionCard({
  action,
  description,
  icon,
  status,
  statusTone = "success",
  title,
  variant = "row",
}: Readonly<Props>) {
  const statusBadge = status != null && (
    <StatusBadge
      className="shrink-0"
      size="sm"
      tone={statusTone === "muted" ? "neutral" : statusTone}
    >
      {status}
    </StatusBadge>
  );

  if (variant === "tile") {
    return (
      <Card
        className="group min-w-0 gap-3"
        size="compact"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-tile bg-surface-hover text-muted-foreground has-[>span]:bg-transparent [&_svg]:size-3.5">
            {icon}
          </span>
          <span className="truncate font-semibold text-sm">{title}</span>
          {status != null && <span className="ml-auto shrink-0">{statusBadge}</span>}
        </div>

        <p className="truncate text-sm text-muted-foreground">{description}</p>

        <div className="mt-auto flex items-center border-border border-t pt-2.5">{action}</div>
      </Card>
    );
  }

  return (
    <Card
      className="group min-w-0 items-center"
      size="row"
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-tile bg-surface-hover text-muted-foreground has-[>span]:bg-transparent [&_svg]:size-4">
        {icon}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-sm">{title}</span>
          {statusBadge}
        </div>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex shrink-0 items-center">{action}</div>
    </Card>
  );
}
