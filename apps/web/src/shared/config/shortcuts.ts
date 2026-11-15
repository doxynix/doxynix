export const SHORTCUT_GROUPS = ["navigation", "actions", "interface", "repoMap"] as const;

export const GLOBAL_HOTKEY_SCOPE = "global";

export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

type ShortcutDefinition = {
  display?: string;
  group: ShortcutGroup;
  href?: string;
  keys: string;
};

export const SHORTCUTS = {
  apiKeys: { group: "navigation", href: "/dashboard/settings/api-keys", keys: "g then k" },
  appearance: { group: "navigation", href: "/dashboard/settings/appearance", keys: "g then a" },
  auditLog: { group: "navigation", href: "/dashboard/settings/audit-log", keys: "g then l" },
  billing: { group: "navigation", href: "/dashboard/settings/billing", keys: "g then b" },
  commandMenu: { group: "interface", keys: "mod+k" },
  connections: { group: "navigation", href: "/dashboard/settings/connections", keys: "g then c" },
  createRepo: { group: "actions", keys: "c then r" },
  dangerZone: { group: "navigation", href: "/dashboard/settings/danger-zone", keys: "g then z" },
  dashboard: { group: "navigation", href: "/dashboard", keys: "g then d" },
  fitView: { group: "repoMap", keys: "f then v" },
  focusSelected: { group: "repoMap", keys: "f then s" },
  members: { group: "navigation", href: "/dashboard/settings/members", keys: "g then t" },
  notifications: { group: "navigation", href: "/dashboard/notifications", keys: "g then n" },
  profile: { group: "navigation", href: "/dashboard/settings/profile", keys: "g then p" },
  repositories: { group: "navigation", href: "/dashboard/repos", keys: "g then r" },
  sessions: { group: "navigation", href: "/dashboard/settings/sessions", keys: "g then m" },
  settings: { group: "navigation", href: "/dashboard/settings", keys: "g then s" },
  shortcutsHelp: { display: "Shift+?", group: "interface", keys: "shift+?" },
  shortLinks: { group: "interface", keys: "mod+/" },
  support: { group: "navigation", href: "/support", keys: "g then h" },
  toggleControls: { group: "repoMap", keys: "t then c" },
  toggleSidebar: { group: "interface", keys: "mod+b" },
  zoomIn: { group: "repoMap", keys: "z then i" },
  zoomOut: { group: "repoMap", keys: "z then o" },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutId = keyof typeof SHORTCUTS;

type ShortcutEntry = ShortcutDefinition & { id: ShortcutId };

const SHORTCUT_ORDER: readonly ShortcutId[] = [
  "dashboard",
  "repositories",
  "settings",
  "notifications",
  "profile",
  "members",
  "billing",
  "appearance",
  "connections",
  "sessions",
  "apiKeys",
  "auditLog",
  "dangerZone",
  "support",
  "createRepo",
  "commandMenu",
  "shortcutsHelp",
  "shortLinks",
  "toggleSidebar",
  "zoomIn",
  "zoomOut",
  "fitView",
  "focusSelected",
  "toggleControls",
];

const SHORTCUT_ORDER_INDEX = new Map(SHORTCUT_ORDER.map((id, index) => [id, index]));

export const SHORTCUT_ENTRIES: readonly ShortcutEntry[] = Object.entries(SHORTCUTS)
  .map(([id, definition]) => ({ id: id as ShortcutId, ...definition }))
  .sort(
    (a, b) =>
      (SHORTCUT_ORDER_INDEX.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (SHORTCUT_ORDER_INDEX.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );

const SEQUENCE_PATTERN = /^([a-z0-9])\s+then\s+([a-z0-9])$/i;
const SEQUENCE_SEPARATOR = /\s+then\s+/i;

const KEY_ALIASES: Record<string, string> = {
  enter: "↵",
  escape: "Esc",
};

export function parseSequentialShortcut(
  keys: string,
): { prefix: string; secondKey: string } | null {
  const match = SEQUENCE_PATTERN.exec(keys.trim());
  if (match == null) {
    return null;
  }

  const [, prefix, secondKey] = match;
  if (prefix == null || secondKey == null) {
    return null;
  }

  return { prefix: prefix.toLowerCase(), secondKey: secondKey.toLowerCase() };
}

export function formatSequence(keys: string): string {
  return keys
    .split(SEQUENCE_SEPARATOR)
    .map((chord) => chord.trim().toUpperCase())
    .join(" then ");
}

export function toHotkeySequence(keys: string): string | null {
  const sequence = parseSequentialShortcut(keys);

  return sequence == null ? null : `${sequence.prefix}>${sequence.secondKey}`;
}

export function formatShortcut(keys: string, modifierKey: string): string {
  return keys
    .split(SEQUENCE_SEPARATOR)
    .map((chord) =>
      chord
        .trim()
        .split("+")
        .map((rawKey) => {
          const key = rawKey.trim().toLowerCase();
          if (key === "mod") {
            return modifierKey;
          }

          const alias = KEY_ALIASES[key];
          if (alias != null) {
            return alias;
          }

          return key.length === 1 ? key.toUpperCase() : key;
        })
        .join("+"),
    )
    .join(" then ");
}
