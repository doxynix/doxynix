import { ComponentType } from "react";
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
import { RepoTableItem } from "@/shared/types/repo";

import { getLanguageColor } from "./language-colors";

type Props = {
  id: string;
  icon?: ComponentType<{ className?: string }>;
  label: string | number | null;
  tooltip?: string;
  color?: string;
  className?: string;
};

export function getGitMetrics(repo: RepoTableItem, locale: string): Props[] {
  const langColor = getLanguageColor(repo.language);

  const items = [
    {
      id: "Language",
      icon: Circle,
      label: repo.language,
      tooltip: "Primary Language",
      color: langColor,
    },
    {
      id: "Stars",
      icon: Star,
      label: repo.stars,
      tooltip: "Stars",
      color: "text-warning fill-current",
    },
    { id: "Forks", icon: GitFork, label: repo.forks, tooltip: "Forks", color: "text-green-700" },
    {
      id: "Branch",
      icon: GitBranch,
      label: repo.defaultBranch,
      tooltip: "Branch",
      color: "text-blue",
    },
    {
      id: "Open Issues",
      icon: CircleDot,
      label: repo.openIssues,
      tooltip: "Open Issues",
      color: "text-destructive",
    },
    {
      id: "License",
      icon: Scale,
      label: repo.license,
      tooltip: "License",
      color: "text-muted-foreground",
    },
    {
      id: "Size",
      icon: HardDrive,
      label: repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)} MB` : `${repo.size} KB`,
      tooltip: "Size",
      color: "text-muted-foreground",
    },
    {
      id: "Last push",
      icon: History,
      label: formatRelativeTime(repo.pushedAt, locale),
      tooltip: "Last push",
      color: "text-muted-foreground",
    },
  ];

  return items.filter((m) => m.label != null);
}
