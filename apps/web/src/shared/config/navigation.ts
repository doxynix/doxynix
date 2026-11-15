import {
  AlertTriangle,
  Bell,
  Book,
  BookOpen,
  Code2,
  CreditCard,
  FileText,
  GitPullRequest,
  HandHeartIcon,
  Headset,
  Home,
  KeyRound,
  LayoutGrid,
  Link,
  Logs,
  MailX,
  Map,
  Palette,
  ScanSearch,
  ScrollText,
  Settings,
  SquareTerminal,
  TabletSmartphone,
  User,
  Users2,
} from "lucide-react";

import type { MenuItem, MenuItems, PublicMenuItem } from "./navigation.types";
import { formatSequence, SHORTCUTS, type ShortcutId } from "./shortcuts";

type SequentialShortcutId = {
  [Id in ShortcutId]: (typeof SHORTCUTS)[Id]["keys"] extends `${string} then ${string}`
    ? Id
    : never;
}[ShortcutId];

const sequenceShortcut = (id: SequentialShortcutId) => formatSequence(SHORTCUTS[id].keys);

const DASHBOARD_BASE: MenuItems = [
  {
    exact: true,
    href: SHORTCUTS.dashboard.href,
    icon: LayoutGrid,
    id: "dashboard",
    labelKey: "dashboard",
    shortcut: sequenceShortcut("dashboard"),
  },
  {
    href: SHORTCUTS.repositories.href,
    icon: Book,
    id: "repositories",
    labelKey: "repositories",
    shortcut: sequenceShortcut("repositories"),
  },
  {
    href: SHORTCUTS.settings.href,
    icon: Settings,
    id: "settings",
    labelKey: "settings",
    shortcut: sequenceShortcut("settings"),
  },
  {
    href: SHORTCUTS.notifications.href,
    icon: Bell,
    id: "notifications",
    labelKey: "notifications",
    shortcut: sequenceShortcut("notifications"),
  },
];

const SETTINGS_PAGES: MenuItems = [
  {
    href: SHORTCUTS.profile.href,
    icon: User,
    id: "profile",
    labelKey: "profile",
    shortcut: sequenceShortcut("profile"),
  },
  {
    href: SHORTCUTS.members.href,
    icon: Users2,
    id: "members",
    labelKey: "members",
    shortcut: sequenceShortcut("members"),
  },
  {
    href: SHORTCUTS.billing.href,
    icon: CreditCard,
    id: "billing",
    labelKey: "billing",
    shortcut: sequenceShortcut("billing"),
  },
  {
    href: SHORTCUTS.appearance.href,
    icon: Palette,
    id: "appearance",
    labelKey: "appearance",
    shortcut: sequenceShortcut("appearance"),
  },
  {
    href: SHORTCUTS.connections.href,
    icon: Link,
    id: "connections",
    labelKey: "connections",
    shortcut: sequenceShortcut("connections"),
  },
  {
    href: SHORTCUTS.sessions.href,
    icon: TabletSmartphone,
    id: "sessions",
    labelKey: "sessions",
    shortcut: sequenceShortcut("sessions"),
  },
  {
    href: SHORTCUTS.apiKeys.href,
    icon: KeyRound,
    id: "api keys",
    labelKey: "api_keys",
    shortcut: sequenceShortcut("apiKeys"),
  },
  {
    href: SHORTCUTS.auditLog.href,
    icon: Logs,
    id: "audit log",
    labelKey: "audit_log",
    shortcut: sequenceShortcut("auditLog"),
  },
  {
    href: SHORTCUTS.dangerZone.href,
    icon: AlertTriangle,
    id: "danger zone",
    labelKey: "danger_zone",
    shortcut: sequenceShortcut("dangerZone"),
    variant: "destructive",
  },
];

const GLOBAL_FEATURES: MenuItems = [
  {
    href: SHORTCUTS.support.href,
    icon: Headset,
    id: "support",
    labelKey: "support",
    shortcut: sequenceShortcut("support"),
  },
];

export const ADMIN_USERS_MENU_ITEM: MenuItem = {
  href: "/admin/users",
  icon: Users2,
  id: "admin_users",
  labelKey: "admin_users",
};

export const ADMIN_AUDIT_MENU_ITEM: MenuItem = {
  href: "/admin/audit",
  icon: ScrollText,
  id: "admin_audit",
  labelKey: "admin_audit",
};

export const ADMIN_BANNED_EMAILS_MENU_ITEM: MenuItem = {
  href: "/admin/banned-emails",
  icon: MailX,
  id: "admin_banned_emails",
  labelKey: "admin_banned_emails",
};

export const ADMIN_REVIEWS_MENU_ITEM: MenuItem = {
  href: "/admin/reviews",
  icon: GitPullRequest,
  id: "admin_reviews",
  labelKey: "admin_reviews",
};

export const ADMIN_SIDEBAR_MENU: MenuItems = [
  ADMIN_USERS_MENU_ITEM,
  ADMIN_REVIEWS_MENU_ITEM,
  ADMIN_AUDIT_MENU_ITEM,
  ADMIN_BANNED_EMAILS_MENU_ITEM,
];

const actionsMenu: MenuItems = [
  {
    actionId: "createRepo",
    commandType: "dialog",
    icon: SquareTerminal,
    id: "createRepo",
    labelKey: "create_repository",
    shortcut: sequenceShortcut("createRepo"),
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
    href: "/docs",
    icon: BookOpen,
    id: "Docs",
    labelKey: "documentation",
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
