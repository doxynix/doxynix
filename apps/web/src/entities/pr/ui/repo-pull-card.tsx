import type { ComponentType } from "react";
import { CheckCircle2, ChevronRight, Clock, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/core/card";
import { StatusBadge } from "@/shared/ui/kit/status-badge";
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

function getRiskTone(score: number): "danger" | "success" | "warning" {
  if (score > 7) {
    return "danger";
  }
  if (score > 4) {
    return "warning";
  }
  return "success";
}

export function RepoPullCard({ name, owner, pull }: Readonly<Props>) {
  const locale = useLocale();
  const t = useTranslations("Dashboard");
  const { className: iconClass, icon: StatusIcon } = getStatusConfig(pull.status);

  return (
    <Card
      asChild
      className="group items-center"
      interactive
      size="row"
    >
      <Link href={`/dashboard/repo/${owner}/${name}/pull/${pull.prNumber}`}>
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-tile bg-muted",
            iconClass,
          )}
        >
          <StatusIcon />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="shrink-0 font-semibold">#{pull.prNumber}</span>
            <span className="truncate text-muted-foreground text-xs">
              ({pull.headSha.slice(0, 7)})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
            <span>{t("repo_pull_card_issues", { count: pull.findingCount })}</span>
            <span
              aria-hidden="true"
              className="text-border-strong"
            >
              ·
            </span>
            <TimeAgo
              className="text-2xs"
              date={pull.createdAt}
              locale={locale}
            />
          </div>
        </div>

        {pull.riskScore !== null && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-2xs text-muted-foreground">{t("repo_pull_card_risk_level")}</span>
            <StatusBadge
              size="sm"
              tone={getRiskTone(pull.riskScore)}
            >
              {pull.riskScore}/10
            </StatusBadge>
          </div>
        )}

        <ChevronRight className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Card>
  );
}
