import type { ComponentType } from "react";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { useLocale } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { RepoPull } from "../model/pr.types";

type Props = {
  name: string;
  owner: string;
  pull: RepoPull;
};

type StatusConfig = {
  className: string;
  icon: ComponentType<{ className?: string }>;
};

function getStatusConfig(status: RepoPull["status"]): StatusConfig {
  if (status === "COMPLETED") {
    return { className: "text-success", icon: CheckCircle2 };
  }
  if (status === "FAILED") {
    return { className: "text-destructive", icon: ShieldAlert };
  }
  return { className: "text-warning", icon: Clock };
}

function getRiskBadgeClass(score: number): string {
  if (score > 7) {
    return "text-destructive";
  }
  if (score > 4) {
    return "text-warning";
  }
  return "text-success";
}

export function RepoPullCard({ name, owner, pull }: Readonly<Props>) {
  const locale = useLocale();
  const { className: iconClass, icon: StatusIcon } = getStatusConfig(pull.status);

  return (
    <Link
      className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
      href={`/dashboard/repo/${owner}/${name}/pull/${pull.prNumber}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center">
          <StatusIcon className={cn("size-5", iconClass)} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-medium">
            <span>#{pull.prNumber}</span>
            <span className="font-mono text-muted-foreground text-sm">
              ({pull.headSha.slice(0, 7)})
            </span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span>Issues: {pull.findingCount}</span>
            <span>•</span>
            <TimeAgo
              date={pull.createdAt}
              locale={locale}
            />
          </div>
        </div>
      </div>

      {pull.riskScore !== null && (
        <div className="flex flex-col items-end">
          <span className="mb-1 text-muted-foreground text-xs">Risk Level</span>
          <AppBadge
            className={cn(getRiskBadgeClass(pull.riskScore))}
            variant="outline"
          >
            {pull.riskScore}/10
          </AppBadge>
        </div>
      )}
    </Link>
  );
}
