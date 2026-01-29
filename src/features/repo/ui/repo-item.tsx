import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn, formatFullDate, formatRelativeTime } from "@/shared/lib/utils";
import { RepoItemFields } from "@/shared/types/repo-item";
import { Button } from "@/shared/ui/core/button";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { getLanguageColor, repoVisibilityConfig } from "@/entities/repo";

type Props = { repo: RepoItemFields; onClick: () => void; disabled?: boolean };

export function RepoItem({ repo, onClick, disabled }: Props) {
  const langColor = getLanguageColor(repo.language);
  const visibility = repoVisibilityConfig[repo.visibility];
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      variant="ghost"
      className="h-auto w-full max-w-md cursor-pointer justify-start px-3 py-2 text-left"
    >
      <div className="flex w-full flex-col gap-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm leading-none font-medium">{repo.fullName}</span>
            {visibility !== null && (
              <AppTooltip content={cn(visibility.label)}>
                <div className="flex shrink-0 items-center gap-1.5 text-xs">
                  <visibility.icon className={cn("h-3.5 w-3.5", visibility.color)} />
                </div>
              </AppTooltip>
            )}
          </div>
          <div className={cn("text-muted-foreground flex shrink-0 items-center gap-1 text-xs")}>
            <Star className="h-3 w-3 fill-current text-yellow-500" />
            {repo.stars.toLocaleString(locale)}
            {langColor !== "" && (
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor }} />
            )}
            <div className="flex items-center gap-1 text-xs">{repo.language}</div>
          </div>
        </div>
        {repo.description !== null && (
          <span className="text-muted-foreground truncate text-xs font-normal opacity-80">
            {repo.description}
          </span>
        )}
        <AppTooltip
          content={t("repo_last_updated", {
            dateTime: formatFullDate(repo.updatedAt, locale),
          })}
        >
          <span className="text-muted-foreground w-fit text-xs">
            {formatRelativeTime(repo.updatedAt, locale)}
          </span>
        </AppTooltip>
      </div>
    </Button>
  );
}
