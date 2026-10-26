import { describe, expect, it } from "vitest";

import { resolveOnboardingStep } from "./onboarding.logic";

describe("resolveOnboardingStep", () => {
  it("starts at welcome when intent has not been saved", () => {
    expect(resolveOnboardingStep({ hasGithubInstallation: false, intent: null })).toBe("welcome");
  });

  it("starts at welcome even when an installation exists but intent is missing", () => {
    expect(resolveOnboardingStep({ hasGithubInstallation: true, intent: null })).toBe("welcome");
  });

  it("moves to github once intent is saved but the app is not installed", () => {
    expect(resolveOnboardingStep({ hasGithubInstallation: false, intent: "ARCHITECTURE" })).toBe(
      "github",
    );
  });

  it("moves to repo when intent and installation both exist", () => {
    expect(resolveOnboardingStep({ hasGithubInstallation: true, intent: "DOCUMENTATION" })).toBe(
      "repo",
    );
  });
});
