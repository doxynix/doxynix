import { LucideIcon } from "lucide-react";
import { IconType } from "react-icons/lib";

export type RepoMetricProps = {
  icon: LucideIcon | IconType;
  label: string | number | null | undefined;
  tooltip?: string;
  color?: string;
  className?: string;
};
