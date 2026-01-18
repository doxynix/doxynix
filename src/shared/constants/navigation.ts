import {
  AlertTriangle,
  Bell,
  FolderGit2,
  Headset,
  Home,
  KeyRound,
  LayoutGrid,
  Link,
  Settings,
  SquareTerminal,
  User,
  Users2,
} from "lucide-react";

import { MenuItem, MenuItems } from "@/shared/types/menuItem";

const DASHBOARD_BASE: MenuItem[] = [
  {
    label: "Обзор",
    icon: LayoutGrid,
    href: "/dashboard",
    shortcut: "Alt+O",
    exact: true,
    url: "/o",
  },
  {
    label: "Репозитории",
    icon: FolderGit2,
    href: "/dashboard/repo",
    shortcut: "Alt+R",
    url: "/r",
  },
  {
    label: "Настройки",
    icon: Settings,
    href: "/dashboard/settings",
    shortcut: "Alt+S",
    url: "/s",
  },
];

const SETTINGS_PAGES: MenuItems = [
  {
    label: "Профиль",
    icon: User,
    href: "/dashboard/settings/profile",
    shortcut: "Alt+P",
    url: "/me",
  },
  {
    label: "API ключи",
    icon: KeyRound,
    href: "/dashboard/settings/api-keys",
    shortcut: "Alt+A",
    url: "/k",
  },
  {
    label: "Опасная зона",
    icon: AlertTriangle,
    href: "/dashboard/settings/danger-zone",
    shortcut: "Alt+D",
    variant: "destructive",
    url: "/d",
  },
];

const GLOBAL_FEATURES: MenuItems = [
  {
    label: "Уведомления",
    icon: Bell,
    href: "/dashboard/notifications",
    shortcut: "Alt+N",
    url: "/n",
  },
  { label: "Поддержка", icon: Headset, href: "/support", shortcut: "Alt+H", url: "/h" },
];

export const actionsMenu: MenuItems = [
  {
    label: "Создать репозиторий",
    icon: SquareTerminal,
    href: "/dashboard/repo/new",
    shortcut: "Alt+N",
    url: "/new",
  },
];

export const sidebarMenu: MenuItems = [...DASHBOARD_BASE];

export const settingsMenu: MenuItems = [...SETTINGS_PAGES];

export const userNavMenu: MenuItems = [SETTINGS_PAGES[0], SETTINGS_PAGES[1]];

export const commandMenuItems: MenuItems = [
  ...DASHBOARD_BASE,
  ...SETTINGS_PAGES,
  ...GLOBAL_FEATURES,
  // ...actionsMenu,
];

export const publicHeaderMenu: MenuItems = [
  { icon: Home, label: "Главная", href: "/" },
  { icon: Users2, label: "О нас", href: "/about" },
  { icon: Headset, label: "Помощь", href: "/support" },
  { icon: Link, label: "Ресурсы", href: "/credits" },
];
