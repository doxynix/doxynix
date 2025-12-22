import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  href: string;
  title: React.ReactNode;
  icon?: LucideIcon;
}

export type MenuItems = MenuItem[];
