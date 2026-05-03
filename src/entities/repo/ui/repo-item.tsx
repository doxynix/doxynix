import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import type { RepoItemFields } from "@/shared/types/repo.types";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import { repoVisibilityConfig } from "@/entities/repo/model/repo-visibility";

type Props = { disabled?: boolean; onClick: () => void; repo: RepoItemFields };

export function RepoItem({ disabled, onClick, repo }: Readonly<Props>) {
  const langColor = repo.languageColor ?? "#ccc";
  const visibility = repoVisibilityConfig[repo.visibility];
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  return (
    <Button
      type="button"
      disabled={disabled}
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full max-w-md cursor-pointer justify-start px-3 py-2 text-left"
    >
      <div className="flex w-full flex-col gap-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-medium">{repo.fullName}</span>
            <div className="flex shrink-0 items-center gap-1.5 text-xs">
              <Badge variant="outline" className={cn(visibility.color)}>
                {visibility.label}
              </Badge>
            </div>
          </div>
          <div className={cn("text-muted-foreground flex shrink-0 items-center gap-1 text-xs")}>
            <Star className="text-warning size-3 fill-current" />
            {repo.stars.toLocaleString(locale)}
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor }} />
            <div className="flex items-center gap-1 text-xs">{repo.language}</div>
          </div>
        </div>
        {repo.description != null && (
          <span className="text-muted-foreground truncate text-xs font-normal opacity-80">
            {repo.description}
          </span>
        )}
        <TimeAgo date={repo.updatedAt} locale={locale} tooltipLabel={t("repo_last_updated")} />
      </div>
    </Button>
  );
}
