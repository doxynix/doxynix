import Link from "next/link";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { formatRelativeTime } from "@/shared/lib/date-utils";
import { Badge } from "@/shared/ui/core/badge";

import type { RepoPull } from "../model/pr.types";

type Props = {
  name: string;
  owner: string;
  pull: RepoPull;
};

export function RepoPullCard({ name, owner, pull }: Readonly<Props>) {
  return (
    <Link
      href={`/dashboard/repo/${owner}/${name}/pull/${pull.prNumber}`}
      className="hover:bg-muted/50 flex items-center justify-between rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center">
          {pull.status === "COMPLETED" ? (
            <CheckCircle2 className="text-success size-5" />
          ) : pull.status === "FAILED" ? (
            <ShieldAlert className="text-destructive size-5" />
          ) : (
            <Clock className="text-warning size-5" />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-medium">
            <span>#{pull.prNumber}</span>
            <span className="text-muted-foreground font-mono text-sm">
              ({pull.headSha.slice(0, 7)})
            </span>
          </div>

          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span>Issues: {pull.findingCount}</span>
            <span>•</span>
            <span>{formatRelativeTime(pull.createdAt)}</span>
          </div>
        </div>
      </div>

      {pull.riskScore !== null && (
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground mb-1 text-xs">Risk Level</span>
          <Badge
            variant="outline"
            className={cn(
              pull.riskScore > 7
                ? "text-destructive"
                : pull.riskScore > 4
                  ? "text-warning"
                  : "text-success"
            )}
          >
            {pull.riskScore}/10
          </Badge>
        </div>
      )}
    </Link>
  );
}
