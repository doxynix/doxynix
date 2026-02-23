import type { LucideIcon } from "lucide-react";

export type StatItem = {
  className?: string;
  description: string;
  icon: LucideIcon;
  iconClass?: string;
  id: string;
  label: string;
  value: string | number;
};
