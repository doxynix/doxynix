import type { OnboardingIntent } from "@doxynix/shared";

import type { OnboardingStep } from "./onboarding.schemas";

export function resolveOnboardingStep(input: {
  hasGithubInstallation: boolean;
  intent: OnboardingIntent | null;
}): OnboardingStep {
  if (input.intent == null) {
    return "welcome";
  }

  if (!input.hasGithubInstallation) {
    return "github";
  }

  return "repo";
}
