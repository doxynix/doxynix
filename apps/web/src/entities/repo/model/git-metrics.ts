import type { ComponentType } from "react";
import {
  Circle,
  CircleDot,
  GitBranch,
  GitFork,
  HardDrive,
  History,
  Scale,
  Star,
} from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/date-utils";

import type { UiRepoListItem } from "./repo.types";

export type GitMetricTooltipKey =
  | "git_metric_branch"
  | "git_metric_forks"
  | "git_metric_last_push"
  | "git_metric_license"
  | "git_metric_open_issues"
  | "git_metric_primary_language"
  | "git_metric_size"
  | "git_metric_stars";

type Props = {
  className?: string;
  color?: string;
  icon?: ComponentType<{ className?: string }>;
  id: string;
  label: null | number | string;
  tooltipKey: GitMetricTooltipKey;
};

type GitMetrics = Pick<
  UiRepoListItem,
  | "defaultBranch"
  | "forks"
  | "id"
  | "language"
  | "languageColor"
  | "license"
  | "openIssues"
  | "pushedAt"
  | "size"
  | "stars"
>;

export function getGitMetrics(repo: GitMetrics, locale: string): Props[] {
  const items: Props[] = [
    {
      color: repo.languageColor,
      icon: Circle,
      id: "Language",
      label: repo.language,
      tooltipKey: "git_metric_primary_language",
    },
    {
      color: "text-warning fill-current",
      icon: Star,
      id: "Stars",
      label: repo.stars,
      tooltipKey: "git_metric_stars",
    },
    {
      color: "text-green-700",
      icon: GitFork,
      id: "Forks",
      label: repo.forks,
      tooltipKey: "git_metric_forks",
    },
    {
      color: "text-foreground",
      icon: GitBranch,
      id: "Branch",
      label: repo.defaultBranch,
      tooltipKey: "git_metric_branch",
    },
    {
      color: "text-destructive",
      icon: CircleDot,
      id: "Open Issues",
      label: repo.openIssues,
      tooltipKey: "git_metric_open_issues",
    },
    {
      color: "text-muted-foreground",
      icon: Scale,
      id: "License",
      label: repo.license,
      tooltipKey: "git_metric_license",
    },
    {
      color: "text-muted-foreground",
      icon: HardDrive,
      id: "Size",
      label: repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)} MB` : `${repo.size} KB`,
      tooltipKey: "git_metric_size",
    },
    {
      color: "text-muted-foreground",
      icon: History,
      id: "Last push",
      label: formatRelativeTime(repo.pushedAt, locale),
      tooltipKey: "git_metric_last_push",
    },
  ];

  return items.filter((m) => m.label != null);
}
