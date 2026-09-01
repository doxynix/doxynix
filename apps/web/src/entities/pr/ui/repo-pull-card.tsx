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

export function RepoPullCard({ name, owner, pull }: Readonly<Props>) {
  const locale = useLocale();

  return (
    <Link
      className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
      href={`/dashboard/repo/${owner}/${name}/pull/${pull.prNumber}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center">
          {pull.status === "COMPLETED" ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : pull.status === "FAILED" ? (
            <ShieldAlert className="size-5 text-destructive" />
          ) : (
            <Clock className="size-5 text-warning" />
          )}
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
            <TimeAgo date={pull.createdAt} locale={locale} />
          </div>
        </div>
      </div>

      {pull.riskScore !== null && (
        <div className="flex flex-col items-end">
          <span className="mb-1 text-muted-foreground text-xs">Risk Level</span>
          <AppBadge
            className={cn(
              pull.riskScore > 7
                ? "text-destructive"
                : pull.riskScore > 4
                  ? "text-warning"
                  : "text-success",
            )}
            variant="outline"
          >
            {pull.riskScore}/10
          </AppBadge>
        </div>
      )}
    </Link>
  );
}
