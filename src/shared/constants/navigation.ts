import {
  AlertTriangle,
  Bell,
  FolderGit2,
  Headset,
  Home,
  KeyRound,
  LayoutGrid,
  Settings,
  SquareTerminal,
  User,
  Users2,
} from "lucide-react";

import type { MenuItem, MenuItems } from "@/shared/types/menu-item";

const DASHBOARD_BASE: MenuItem[] = [
  {
    exact: true,
    href: "/dashboard",
    icon: LayoutGrid,
    label: "Dashboard",
    shortcut: "G then O",
    url: "/o",
  },
  {
    href: "/dashboard/repo",
    icon: FolderGit2,
    label: "Repositories",
    shortcut: "G then R",
    url: "/r",
  },
  {
    href: "/dashboard/settings",
    icon: Settings,
    label: "Settings",
    shortcut: "G then S",
    url: "/s",
  },
];

const SETTINGS_PAGES: MenuItems = [
  {
    href: "/dashboard/settings/profile",
    icon: User,
    label: "Profile",
    shortcut: "G then P",
    url: "/me",
  },
  {
    href: "/dashboard/settings/api-keys",
    icon: KeyRound,
    label: "API Keys",
    shortcut: "G then K",
    url: "/k",
  },
  {
    href: "/dashboard/settings/danger-zone",
    icon: AlertTriangle,
    label: "Danger Zone",
    shortcut: "G then D",
    url: "/d",
    variant: "destructive",
  },
];

const GLOBAL_FEATURES: MenuItems = [
  {
    href: "/dashboard/notifications",
    icon: Bell,
    label: "Notifications",
    shortcut: "G then N",
    url: "/n",
  },
  { href: "/support", icon: Headset, label: "Support", shortcut: "G then H", url: "/h" },
];

export const actionsMenu: MenuItems = [
  {
    actionId: "createRepo",
    commandType: "dialog",
    icon: SquareTerminal,
    label: "Create Repository",
    shortcut: "C then N",
  },
];

export const sidebarMenu: MenuItems = [...DASHBOARD_BASE];

export const settingsMenu: MenuItems = [...SETTINGS_PAGES];

export const userNavMenu: MenuItems = [SETTINGS_PAGES[0], SETTINGS_PAGES[1]];

export const commandMenuItems: MenuItems = [
  ...DASHBOARD_BASE,
  ...SETTINGS_PAGES,
  ...GLOBAL_FEATURES,
  ...actionsMenu,
];

export const publicHeaderMenu: MenuItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/about", icon: Users2, label: "About" },
  { href: "/support", icon: Headset, label: "Help" },
];
