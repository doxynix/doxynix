import {
  AlertTriangle,
  Bell,
  Book,
  BookOpen,
  Code2,
  FileText,
  GitPullRequest,
  HandHeartIcon,
  Headset,
  Home,
  KeyRound,
  LayoutGrid,
  Link,
  Logs,
  Map,
  ScanSearch,
  Settings,
  SquareTerminal,
  TabletSmartphone,
  User,
  Users2,
} from "lucide-react";

import type { MenuItem, MenuItems, PublicMenuItem } from "./navigation.types";

const DASHBOARD_BASE: MenuItems = [
  {
    exact: true,
    href: "/dashboard",
    icon: LayoutGrid,
    id: "dashboard",
    labelKey: "dashboard",
    shortcut: "G then O",
    url: "/o",
  },
  {
    href: "/dashboard/repos",
    icon: Book,
    id: "repositories",
    labelKey: "repositories",
    shortcut: "G then R",
    url: "/r",
  },
  {
    href: "/dashboard/settings",
    icon: Settings,
    id: "settings",
    labelKey: "settings",
    shortcut: "G then S",
    url: "/s",
  },
  {
    href: "/dashboard/notifications",
    icon: Bell,
    id: "notifications",
    labelKey: "notifications",
    shortcut: "G then N",
    url: "/n",
  },
];

const SETTINGS_PAGES: MenuItems = [
  {
    href: "/dashboard/settings/profile",
    icon: User,
    id: "profile",
    labelKey: "profile",
    shortcut: "G then P",
    url: "/me",
  },
  {
    href: "/dashboard/settings/connections",
    icon: Link,
    id: "connections",
    labelKey: "connections",
    shortcut: "G then C",
    url: "/c",
  },
  {
    href: "/dashboard/settings/sessions",
    icon: TabletSmartphone,
    id: "sessions",
    labelKey: "sessions",
    shortcut: "G then M",
    url: "/ms",
  },
  {
    href: "/dashboard/settings/api-keys",
    icon: KeyRound,
    id: "api keys",
    labelKey: "api_keys",
    shortcut: "G then K",
    url: "/k",
  },
  {
    href: "/dashboard/settings/audit-log",
    icon: Logs,
    id: "audit log",
    labelKey: "audit_log",
    shortcut: "G then L",
    url: "/l",
  },
  {
    href: "/dashboard/settings/danger-zone",
    icon: AlertTriangle,
    id: "danger zone",
    labelKey: "danger_zone",
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
    labelKey: "support",
    shortcut: "G then H",
    url: "/h",
  },
];

const actionsMenu: MenuItems = [
  {
    actionId: "createRepo",
    commandType: "dialog",
    icon: SquareTerminal,
    id: "createRepo",
    labelKey: "create_repository",
    shortcut: "C then R",
  },
];

export const sidebarMenu: MenuItems = [...DASHBOARD_BASE];

export const settingsMenu: MenuItems = [...SETTINGS_PAGES];

export const userNavMenu: MenuItems = [
  SETTINGS_PAGES[0],
  SETTINGS_PAGES[1],
  DASHBOARD_BASE[1],
].filter((item): item is MenuItem => item != null);

export const commandMenuItems: MenuItems = [
  ...DASHBOARD_BASE,
  ...SETTINGS_PAGES,
  ...GLOBAL_FEATURES,
  ...actionsMenu,
];

export const publicHeaderMenu: PublicMenuItem[] = [
  {
    href: "/",
    icon: Home,
    id: "Home",
    labelKey: "home",
  },
  {
    href: "/about",
    icon: Users2,
    id: "About",
    labelKey: "about",
  },
  {
    href: "/support",
    icon: Headset,
    id: "Help",
    labelKey: "help",
  },
  {
    href: "/high-five",
    icon: HandHeartIcon,
    id: "HighFive",
    labelKey: "high_five",
  },
];

export const getRepoDetailsMenu = (owner: string, name: string): MenuItems => {
  const base = `/dashboard/repo/${owner}/${name}`;

  return [
    {
      exact: true,
      href: base,
      icon: BookOpen,
      id: "overview",
      labelKey: "overview",
    },
    {
      href: `${base}/analyze`,
      icon: ScanSearch,
      id: "analyze",
      labelKey: "analyze",
    },
    {
      href: `${base}/map`,
      icon: Map,
      id: "map",
      labelKey: "map",
    },
    {
      href: `${base}/pulls`,
      icon: GitPullRequest,
      id: "pulls",
      labelKey: "pulls",
    },
    {
      href: `${base}/code`,
      icon: Code2,
      id: "code",
      labelKey: "code",
    },
    {
      href: `${base}/docs`,
      icon: FileText,
      id: "documentation",
      labelKey: "documentation",
    },
    {
      href: `${base}/settings`,
      icon: Settings,
      id: "settings",
      labelKey: "settings",
    },
  ];
};
