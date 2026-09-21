import { useTranslations } from "next-intl";

import type { NavLabelKey } from "./navigation.types";

/**
 * Resolves navigation labels for client components.
 *
 * The `t()` calls are intentionally literal: eloqnt's orphan detection is
 * disabled as soon as any dynamic `t(variable)` call exists, so passing a key
 * straight through would silently drop that safety net for the whole app.
 */
export function useNavLabels(): Record<NavLabelKey, string> {
  const t = useTranslations("Common");

  return {
    about: t("nav_about"),
    analyze: t("nav_analyze"),
    api_keys: t("nav_api_keys"),
    audit_log: t("nav_audit_log"),
    code: t("nav_code"),
    connections: t("nav_connections"),
    create_repository: t("nav_create_repository"),
    danger_zone: t("nav_danger_zone"),
    dashboard: t("nav_dashboard"),
    documentation: t("nav_documentation"),
    help: t("nav_help"),
    high_five: t("nav_high_five"),
    home: t("nav_home"),
    map: t("nav_map"),
    notifications: t("nav_notifications"),
    overview: t("nav_overview"),
    profile: t("nav_profile"),
    pulls: t("nav_pulls"),
    repositories: t("nav_repositories"),
    sessions: t("nav_sessions"),
    settings: t("nav_settings"),
    support: t("nav_support"),
  };
}
