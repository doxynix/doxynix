import Link from "next/link";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";

import type { RepoPull } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { formatRelativeTime } from "@/shared/lib/date-utils";

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
        <div className="flex size-10 items-center justify-center rounded-full border">
          {pull.status === "COMPLETED" ? (
            <CheckCircle2 className="size-5 text-green-500" />
          ) : pull.status === "FAILED" ? (
            <ShieldAlert className="size-5 text-red-500" />
          ) : (
            <Clock className="size-5 animate-pulse text-yellow-500" />
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
            <span>{formatRelativeTime(pull.createdAt)} ago</span>
          </div>
        </div>
      </div>

      {pull.riskScore !== null && (
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground mb-1 text-xs">Risk Level</span>
          <div
            className={cn(
              "rounded border px-2 py-0.5 text-sm font-bold",
              pull.riskScore > 7
                ? "border-red-500/20 bg-red-500/10 text-red-500"
                : pull.riskScore > 4
                  ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
                  : "border-green-500/20 bg-green-500/10 text-green-500"
            )}
          >
            {pull.riskScore}/10
          </div>
        </div>
      )}
    </Link>
  );
}
