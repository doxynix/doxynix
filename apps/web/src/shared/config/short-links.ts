import type { NavLabelKey } from "./navigation.types";

export type ShortLink = {
  destination: string;
  source: string;
};

export const SHORT_LINKS = [
  { destination: "/dashboard", source: "/d" },
  { destination: "/dashboard", source: "/dash" },
  { destination: "/dashboard", source: "/home" },

  { destination: "/dashboard/settings/profile", source: "/dashboard/settings" },
  { destination: "/dashboard/repos", source: "/dashboard/repo" },
  {
    destination: "/dashboard/repo/:owner/:name/pulls",
    source: "/dashboard/repo/:owner/:name/pull",
  },

  { destination: "/dashboard/repos", source: "/r" },
  { destination: "/dashboard/repos", source: "/repos" },
  { destination: "/dashboard/repos", source: "/code" },

  { destination: "/dashboard/settings/profile", source: "/s" },
  { destination: "/dashboard/settings/profile", source: "/settings" },
  { destination: "/dashboard/settings/profile", source: "/me" },
  { destination: "/dashboard/settings/profile", source: "/profile" },

  { destination: "/dashboard/settings/api-keys", source: "/k" },
  { destination: "/dashboard/settings/api-keys", source: "/keys" },
  { destination: "/dashboard/settings/api-keys", source: "/token" },
  { destination: "/dashboard/settings/api-keys", source: "/api" },

  { destination: "/dashboard/notifications", source: "/n" },
  { destination: "/dashboard/notifications", source: "/notif" },
  { destination: "/dashboard/notifications", source: "/inbox" },
  { destination: "/dashboard/notifications", source: "/alerts" },

  { destination: "/dashboard/settings/members", source: "/mt" },
  { destination: "/dashboard/settings/members", source: "/members" },

  { destination: "/dashboard/settings/billing", source: "/b" },
  { destination: "/dashboard/settings/billing", source: "/billing" },

  { destination: "/dashboard/settings/appearance", source: "/a" },
  { destination: "/dashboard/settings/appearance", source: "/appearance" },

  { destination: "/dashboard/settings/connections", source: "/c" },
  { destination: "/dashboard/settings/connections", source: "/connections" },

  { destination: "/dashboard/settings/sessions", source: "/ms" },
  { destination: "/dashboard/settings/sessions", source: "/sessions" },

  { destination: "/dashboard/settings/audit-log", source: "/l" },
  { destination: "/dashboard/settings/audit-log", source: "/audit" },

  { destination: "/admin/users", source: "/au" },

  { destination: "/dashboard/settings/danger-zone", source: "/z" },
  { destination: "/dashboard/settings/danger-zone", source: "/dz" },
  { destination: "/dashboard/settings/danger-zone", source: "/danger" },
  { destination: "/dashboard/settings/danger-zone", source: "/rip" },

  { destination: "/auth", source: "/in" },
  { destination: "/auth", source: "/login" },
  { destination: "/auth", source: "/join" },

  { destination: "/support", source: "/h" },

  { destination: "/terms", source: "/tos" },
  { destination: "/privacy", source: "/pp" },

  { destination: "https://status.doxynix.space", source: "/status" },
] as const satisfies readonly ShortLink[];

export const HELP_SHORT_LINKS = [
  { labelKey: "dashboard", path: "/d" },
  { labelKey: "repositories", path: "/r" },
  { labelKey: "settings", path: "/s" },
  { labelKey: "notifications", path: "/n" },
  { labelKey: "profile", path: "/me" },
  { labelKey: "members", path: "/mt" },
  { labelKey: "billing", path: "/b" },
  { labelKey: "appearance", path: "/a" },
  { labelKey: "connections", path: "/c" },
  { labelKey: "sessions", path: "/ms" },
  { labelKey: "api_keys", path: "/k" },
  { labelKey: "audit_log", path: "/l" },
  { labelKey: "danger_zone", path: "/z" },
  { labelKey: "support", path: "/h" },
] as const satisfies readonly { labelKey: NavLabelKey; path: string }[];
