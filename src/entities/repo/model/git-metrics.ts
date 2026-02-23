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

import { formatRelativeTime } from "@/shared/lib/utils";
import type { RepoTableItem } from "@/shared/types/repo";

import { getLanguageColor } from "./language-colors";

type Props = {
  className?: string;
  color?: string;
  icon?: ComponentType<{ className?: string }>;
  id: string;
  label: string | number | null;
  tooltip?: string;
};

export function getGitMetrics(repo: RepoTableItem, locale: string): Props[] {
  const langColor = getLanguageColor(repo.language);

  const items = [
    {
      color: langColor,
      icon: Circle,
      id: "Language",
      label: repo.language,
      tooltip: "Primary Language",
    },
    {
      color: "text-warning fill-current",
      icon: Star,
      id: "Stars",
      label: repo.stars,
      tooltip: "Stars",
    },
    { color: "text-green-700", icon: GitFork, id: "Forks", label: repo.forks, tooltip: "Forks" },
    {
      color: "text-blue",
      icon: GitBranch,
      id: "Branch",
      label: repo.defaultBranch,
      tooltip: "Branch",
    },
    {
      color: "text-destructive",
      icon: CircleDot,
      id: "Open Issues",
      label: repo.openIssues,
      tooltip: "Open Issues",
    },
    {
      color: "text-muted-foreground",
      icon: Scale,
      id: "License",
      label: repo.license,
      tooltip: "License",
    },
    {
      color: "text-muted-foreground",
      icon: HardDrive,
      id: "Size",
      label: repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)} MB` : `${repo.size} KB`,
      tooltip: "Size",
    },
    {
      color: "text-muted-foreground",
      icon: History,
      id: "Last push",
      label: formatRelativeTime(repo.pushedAt, locale),
      tooltip: "Last push",
    },
  ];

  return items.filter((m) => m.label != null);
}
