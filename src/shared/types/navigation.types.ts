import type { ComponentType } from "react";

export type MenuItem = {
  actionId?: string;
  commandType?: "action" | "dialog" | "navigation";
  exact?: boolean;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  id?: string;
  isBlank?: boolean;
  label: string;
  notificationsCount?: number;
  shortcut?: string;
  url?: string;
  variant?: "default" | "destructive";
};

export type MenuItems = MenuItem[];
