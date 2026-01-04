import { ComponentType, ReactNode } from "react";

export type MenuItem = {
  href: string;
  title: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  isBlank?: boolean;
};

export type MenuItems = MenuItem[];
