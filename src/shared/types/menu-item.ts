import type { ComponentType } from "react";

export type MenuItem = {
  actionId?: string;
  commandType?: "navigation" | "action" | "dialog";
  exact?: boolean;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  isBlank?: boolean;
  label: string;
  shortcut?: string;
  url?: string;
  variant?: "default" | "destructive";
};

export type MenuItems = MenuItem[];
