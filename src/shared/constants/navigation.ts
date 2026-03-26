import {
  AlertTriangle,
  BarChart3,
  Bell,
  Code2,
  FileText,
  FolderGit2,
  Headset,
  HistoryIcon,
  Home,
  KeyRound,
  LayoutGrid,
  Settings,
  SquareTerminal,
  User,
  Users2,
  Zap,
} from "lucide-react";

import type { MenuItems } from "../types/navigation";

const DASHBOARD_BASE: MenuItems = [
  {
    exact: true,
    href: "/dashboard",
    icon: LayoutGrid,
    id: "dashboard",
    label: "Dashboard",
    shortcut: "G then O",
    url: "/o",
  },
  {
    href: "/dashboard/repo",
    icon: FolderGit2,
    id: "repositories",
    label: "Repositories",
    shortcut: "G then R",
    url: "/r",
  },
  {
    href: "/dashboard/settings",
    icon: Settings,
    id: "settings",
    label: "Settings",
    shortcut: "G then S",
    url: "/s",
  },
  {
    href: "/dashboard/notifications",
    icon: Bell,
    id: "notifications",
    label: "Notifications",
    shortcut: "G then N",
    url: "/n",
  },
];

const SETTINGS_PAGES: MenuItems = [
  {
    href: "/dashboard/settings/profile",
    icon: User,
    id: "profile",
    label: "Profile",
    shortcut: "G then P",
    url: "/me",
  },
  {
    href: "/dashboard/settings/api-keys",
    icon: KeyRound,
    id: "api keys",
    label: "API Keys",
    shortcut: "G then K",
    url: "/k",
  },
  {
    href: "/dashboard/settings/danger-zone",
    icon: AlertTriangle,
    id: "danger zone",
    label: "Danger Zone",
    shortcut: "G then D",
    url: "/d",
    variant: "destructive",
  },
];

const GLOBAL_FEATURES: MenuItems = [
  {
    href: "/support",
    icon: Headset,
    id: "support",
    label: "Support",
    shortcut: "G then H",
    url: "/h",
  },
];

export const actionsMenu: MenuItems = [
  {
    actionId: "createRepo",
    commandType: "dialog",
    icon: SquareTerminal,
    id: "createRepo",
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
  {
    href: "/",
    icon: Home,
    id: "Home",
    label: "Home",
  },
  {
    href: "/about",
    icon: Users2,
    id: "About",
    label: "About",
  },
  {
    href: "/support",
    icon: Headset,
    id: "Help",
    label: "Help",
  },
];

export const getRepoDetailsMenu = (owner: string, name: string): MenuItems => {
  const base = `/dashboard/repo/${owner}/${name}`;

  return [
    {
      exact: true,
      href: base,
      icon: LayoutGrid,
      id: "overview",
      label: "Overview",
    },
    {
      href: `${base}/analyze`,
      icon: Zap,
      id: "analyze",
      label: "Analyze",
    },
    {
      href: `${base}/code`,
      icon: Code2,
      id: "code",
      label: "Code",
    },
    {
      href: `${base}/docs`,
      icon: FileText,
      id: "documentation",
      label: "Documentation",
    },
    {
      href: `${base}/history`,
      icon: HistoryIcon,
      id: "history",
      label: "History",
    },
    {
      href: `${base}/metrics`,
      icon: BarChart3,
      id: "metrics",
      label: "Metrics",
    },
    {
      href: `${base}/settings`,
      icon: Settings,
      id: "settings",
      label: "Settings",
    },
  ];
};
