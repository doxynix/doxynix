import { useTranslations } from "next-intl";

import type { ShortcutId } from "./shortcuts";

export function useShortcutLabels(): Record<ShortcutId, string> {
  const tCommon = useTranslations("Common");
  const tDashboard = useTranslations("Dashboard");

  return {
    apiKeys: tCommon("nav_api_keys"),
    appearance: tCommon("nav_appearance"),
    auditLog: tCommon("nav_audit_log"),
    billing: tCommon("nav_billing"),
    commandMenu: tCommon("command_menu_title"),
    connections: tCommon("nav_connections"),
    createRepo: tCommon("nav_create_repository"),
    dangerZone: tCommon("nav_danger_zone"),
    dashboard: tCommon("nav_dashboard"),
    fitView: tDashboard("repo_map_fit_view"),
    focusSelected: tDashboard("repo_map_focus_selected"),
    members: tCommon("nav_members"),
    notifications: tCommon("nav_notifications"),
    profile: tCommon("nav_profile"),
    repositories: tCommon("nav_repositories"),
    sessions: tCommon("nav_sessions"),
    settings: tCommon("nav_settings"),
    shortcutsHelp: tCommon("nav_keyboard_shortcuts"),
    shortLinks: tCommon("nav_short_links"),
    support: tCommon("nav_support"),
    toggleControls: tDashboard("repo_map_toggle_controls"),
    toggleSidebar: tCommon("toggle_sidebar_shortcut"),
    zoomIn: tDashboard("repo_map_zoom_in"),
    zoomOut: tDashboard("repo_map_zoom_out"),
  };
}
