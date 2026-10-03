import posthog from "posthog-js";

export type ClientAnalyticsEvent =
  | "account_deleted"
  | "all_repos_deleted"
  | "api_key_created"
  | "api_key_revoked"
  | "doc_copied"
  | "doc_downloaded"
  | "doc_viewed"
  | "fix_requested"
  | "fix_staged"
  | "github_app_install_failed"
  | "github_app_install_started"
  | "github_integration_failed"
  | "github_integration_success"
  | "github_oauth_failed"
  | "github_oauth_started"
  | "pr_findings_viewed"
  | "pr_opened"
  | "pricing_plan_clicked"
  | "profile_updated"
  | "repo_added"
  | "repo_analysis_started"
  | "repo_deleted"
  | "repos_by_owner_deleted"
  | "sign_in_attempted"
  | "sign_in_email_sent";

export type IdentifyUserInput = {
  createdAt: Date;
  role: string;
  twoFactorEnabled?: boolean | null;
  userId: string;
};

export function trackClientEvent(
  event: ClientAnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  posthog.capture(event, properties);
}

export function identifyUser(user: IdentifyUserInput | null): void {
  if (user == null) {
    posthog.reset();
    return;
  }

  posthog.identify(user.userId, {
    name: "",
    role: user.role,
    signup_cohort: `${user.createdAt.getUTCFullYear()}-${String(user.createdAt.getUTCMonth() + 1).padStart(2, "0")}`,
    two_factor_enabled: user.twoFactorEnabled === true,
  });
}

export function getClientSessionId(): string {
  return posthog.get_session_id();
}
