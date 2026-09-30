import type { ComponentType } from "react";

// An explicit union (not inline strings) so the resolver in navigation-labels.ts is checked for completeness against it.
export type NavLabelKey =
  | "about"
  | "analyze"
  | "api_keys"
  | "audit_log"
  | "code"
  | "connections"
  | "create_repository"
  | "danger_zone"
  | "dashboard"
  | "documentation"
  | "help"
  | "high_five"
  | "home"
  | "map"
  | "notifications"
  | "overview"
  | "profile"
  | "pulls"
  | "repositories"
  | "sessions"
  | "settings"
  | "support";

export type PublicNavLabelKey = Extract<NavLabelKey, "about" | "help" | "high_five" | "home">;

export type MenuItem = {
  actionId?: string;
  avatar?: string;
  commandType?: "action" | "dialog" | "navigation";
  exact?: boolean;
  href?: string;
  icon?: ComponentType<{ className?: string }>;
  id?: string;
  isBlank?: boolean;
  labelKey: NavLabelKey;
  notificationsCount?: number;
  shortcut?: string;
  url?: string;
  variant?: "default" | "destructive";
};

export type MenuItems = MenuItem[];

export type PublicMenuItem = Omit<MenuItem, "labelKey"> & { labelKey: PublicNavLabelKey };
