import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  CircleDot,
  GitBranch,
  GitFork,
  HardDrive,
  History,
  LucideIcon,
  Scale,
  Tag,
} from "lucide-react";
import { FaStar } from "react-icons/fa";
import { IconType } from "react-icons/lib";

import { RepoTableItem } from "@/entities/repo/model/types";

export type MetricsProps = {
  icon: LucideIcon | IconType;
  label: string | number | null;
  tooltip?: string;
  color?: string;
  className?: string;
};

export function getMetrics(repo: RepoTableItem): MetricsProps[] {
  const items = [
    { icon: FaStar, label: repo.stars, tooltip: "Звезды", color: "gold" },
    { icon: GitFork, label: repo.forks, tooltip: "Форки", color: "green" },
    {
      icon: GitBranch,
      label: repo.defaultBranch,
      tooltip: "Ветка",
      color: "dodgerblue",
    },
    {
      icon: CircleDot,
      label: repo.openIssues,
      tooltip: "Open Issues",
      color: "red",
    },
    { icon: Scale, label: repo.license, tooltip: "Лицензия", color: "teal" },
    {
      icon: Tag,
      label: repo.topics?.slice(0, 2).join(", "),
      tooltip: `Теги: ${repo.topics?.join(", ")}`,
      color: "skyblue",
    },
    {
      icon: HardDrive,
      label: repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)} MB` : `${repo.size} KB`,
      tooltip: "Размер",
      color: "gray",
    },
    {
      icon: History,
      label: repo.pushedAt
        ? formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true, locale: ru })
        : null,
      tooltip: "Последний пуш",
      color: "white",
    },
  ] satisfies MetricsProps[];

  return items.filter((m) => m.label != null);
}
