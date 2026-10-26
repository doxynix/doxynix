import { describe, expect, it } from "vitest";

import { resolveGithubSetupRedirect } from "./github-setup-redirect";

describe("resolveGithubSetupRedirect", () => {
  it("returns to welcome after a successful install while onboarding is incomplete", () => {
    expect(resolveGithubSetupRedirect("success", false)).toBe("/welcome");
  });

  it("returns to the dashboard after a successful install when onboarding is complete", () => {
    expect(resolveGithubSetupRedirect("success", true)).toBe("/dashboard?success=github_connected");
  });

  it("returns to welcome with an error while onboarding is incomplete", () => {
    expect(resolveGithubSetupRedirect("error", false)).toBe("/welcome?error=setup_failed");
  });

  it("returns to the dashboard with an error when onboarding is complete", () => {
    expect(resolveGithubSetupRedirect("error", true)).toBe("/dashboard?error=setup_failed");
  });

  it("keeps missing parameters on the same surface", () => {
    expect(resolveGithubSetupRedirect("missing_params", false)).toBe(
      "/welcome?error=setup_params_missing",
    );
    expect(resolveGithubSetupRedirect("missing_params", true)).toBe(
      "/dashboard?error=setup_params_missing",
    );
  });
});
