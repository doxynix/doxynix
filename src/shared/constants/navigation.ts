import {
  AlertTriangle,
  FolderGit2,
  Headset,
  Home,
  KeyRound,
  LayoutGrid,
  Link,
  Settings,
  User,
  Users2,
} from "lucide-react";

import { MenuItem, MenuItems } from "@/shared/types/menuItem";

const DASHBOARD_BASE: MenuItem[] = [
  { label: "Обзор", icon: LayoutGrid, href: "/dashboard", shortcut: "Alt+O" },
  {
    label: "Репозитории",
    icon: FolderGit2,
    href: "/dashboard/repo",
    shortcut: "Alt+R",
    exact: true,
  },
  { label: "Настройки", icon: Settings, href: "/dashboard/settings", shortcut: "Alt+S" },
];

const SETTINGS_BASE: MenuItem[] = [
  { label: "Профиль", icon: User, href: "/dashboard/settings/profile", shortcut: "Alt+P" },
  { label: "API ключи", icon: KeyRound, href: "/dashboard/settings/api-keys", shortcut: "Alt+A" },
  {
    label: "Опасная зона",
    icon: AlertTriangle,
    href: "/dashboard/settings/danger-zone",
    shortcut: "Alt+D",
    variant: "destructive",
  },
];

export const sidebarMenu: MenuItems = [...DASHBOARD_BASE];

export const userNavMenu: MenuItems = SETTINGS_BASE.filter((item) => item.label !== "Опасная зона");

export const dashboardMenu: MenuItems = [...DASHBOARD_BASE];
export const settingsMenu: MenuItems = [...SETTINGS_BASE];

export const publicHeaderMenu: MenuItems = [
  { icon: Home, label: "Главная", href: "/" },
  { icon: Users2, label: "О нас", href: "/about" },
  { icon: Headset, label: "Помощь", href: "/support" },
  { icon: Link, label: "Ресурсы", href: "/credits" },
];
