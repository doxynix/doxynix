import { ComponentType } from "react";

export type MenuItem = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  isBlank?: boolean;
  shortcut?: string;
  url?: string;
  exact?: boolean;
  variant?: "default" | "destructive";
  commandType?: "navigation" | "action" | "dialog";
  actionId?: string;
};

export type MenuItems = MenuItem[];
