import { ComponentType } from "react";

export type MenuItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  isBlank?: boolean;
  shortcut?: string;
  exact?: boolean;
  variant?: "default" | "destructive";
};

export type MenuItems = MenuItem[];
