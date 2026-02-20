import type { LucideIcon } from "lucide-react";

export type StatItem = {
  id: string;
  label: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  className?: string;
  iconClass?: string;
};
