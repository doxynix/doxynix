export type GithubSetupOutcome = "error" | "missing_params" | "success";

export function resolveGithubSetupRedirect(
  outcome: GithubSetupOutcome,
  onboardingCompleted: boolean,
): string {
  if (onboardingCompleted) {
    return outcome === "success"
      ? "/dashboard?success=github_connected"
      : `/dashboard?error=${outcome === "error" ? "setup_failed" : "setup_params_missing"}`;
  }

  return outcome === "success"
    ? "/welcome"
    : `/welcome?error=${outcome === "error" ? "setup_failed" : "setup_params_missing"}`;
}
