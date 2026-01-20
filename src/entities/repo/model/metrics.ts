import { ComponentType } from "react";
import { CircleDot, GitBranch, GitFork, HardDrive, History, Scale, Star, Tag } from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/utils";

import { RepoTableItem } from "@/entities/repo/model/types";

type Props = {
  icon?: ComponentType<{ className?: string }>;
  label: string | number | null;
  tooltip?: string;
  color?: string;
  className?: string;
};

export function getMetrics(repo: RepoTableItem): Props[] {
  const items = [
    { icon: Star, label: repo.stars, tooltip: "Stars", color: "text-yellow-500 fill-current" },
    { icon: GitFork, label: repo.forks, tooltip: "Forks", color: "text-green-700" },
    {
      icon: GitBranch,
      label: repo.defaultBranch,
      tooltip: "Branch",
      color: "text-blue-700",
    },
    {
      icon: CircleDot,
      label: repo.openIssues,
      tooltip: "Open Issues",
      color: "text-red-700",
    },
    { icon: Scale, label: repo.license, tooltip: "License", color: "text-muted-foreground" },
    {
      icon: Tag,
      label: repo.topics?.slice(0, 2).join(", "),
      tooltip: `Tags: ${repo.topics?.join(", ")}`,
      color: "text-blue-300",
    },
    {
      icon: HardDrive,
      label: repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)} MB` : `${repo.size} KB`,
      tooltip: "Size",
      color: "text-muted-foreground",
    },
    {
      icon: History,
      label: formatRelativeTime(repo.pushedAt),
      tooltip: "Last push",
      color: "text-muted-foreground",
    },
  ] satisfies Props[];

  return items.filter((m) => m.label != null);
}
