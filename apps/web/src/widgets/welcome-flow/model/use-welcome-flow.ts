import { useEffect, useRef, useState } from "react";
import type { OnboardingIntent } from "@doxynix/shared";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

import type { RepoItemFields } from "@/shared/api/repo.types";
import { type RouterOutput, useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { authClient, type User } from "@/shared/lib/auth-client";
import { deriveDefaultName, isPlaceholderName } from "@/shared/lib/default-name";
import { intentToAnalyzeHref } from "@/shared/lib/onboarding-intent";
import { trackClientEvent } from "@/shared/lib/posthog-client";

type OnboardingState = RouterOutput["user"]["getOnboardingState"];
type OnboardingStep = OnboardingState["step"];

type Input = {
  initialState: OnboardingState;
  user: User;
};

function initialName(user: User): string {
  if (!isPlaceholderName(user.name, user.email)) {
    return user.name;
  }

  return deriveDefaultName(user.email);
}

function repoOwnerAndName(repo: RepoItemFields): { name: string; owner: string } | null {
  const [owner, name] = repo.fullName.split("/");

  if (owner == null || name == null) {
    return null;
  }

  return { name, owner };
}

function isAlreadyAdded(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("already");
}

export function useWelcomeFlow({ initialState, user }: Input) {
  const trpc = useTRPC();
  const router = useRouter();
  const t = useTranslations("Welcome");

  const [step, setStep] = useState<OnboardingStep>(initialState.step);
  const [name, setName] = useState(() => initialName(user));
  const [intent, setIntent] = useState<OnboardingIntent>(initialState.intent ?? "ARCHITECTURE");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const viewedRef = useRef(false);

  const saveIdentity = useMutation(trpc.user.saveOnboardingIdentity.mutationOptions());
  const complete = useMutation(trpc.user.completeOnboarding.mutationOptions());
  const createRepo = useMutation(trpc.repo.create.mutationOptions());

  const [error, setError] = useQueryState("error");

  const hasGithubInstallation = initialState.hasGithubInstallation;

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }

    viewedRef.current = true;
    trackClientEvent("welcome_viewed");
  }, []);

  useEffect(() => {
    trackClientEvent("welcome_step_viewed", { step });
  }, [step]);

  useEffect(() => {
    if (error == null) {
      return;
    }

    toast.error(t("github_error"));
    void setError(null);
  }, [error, setError, t]);

  const handleIntentChange = (nextIntent: OnboardingIntent) => {
    setIntent(nextIntent);
    trackClientEvent("welcome_intent_selected", { intent: nextIntent });
  };

  const persistIdentity = async () => {
    const trimmedName = name.trim();

    await saveIdentity.mutateAsync({
      intent,
      name: trimmedName,
    });

    await authClient.updateUser({ name: trimmedName }).catch(() => {
      // The DB write is the source of truth; the session refresh is best-effort.
    });
  };

  const handleWelcomeContinue = () => {
    setIsSaving(true);

    void persistIdentity()
      .then(() => {
        setStep(hasGithubInstallation ? "repo" : "github");
      })
      .catch(() => {
        toast.error(t("error_generic"));
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleSkip = () => {
    setIsSaving(true);

    const identity =
      name.trim().length > 0
        ? persistIdentity().catch(() => {
            // Skipping must still work if the identity save fails.
          })
        : Promise.resolve();

    void identity
      .then(() => complete.mutateAsync({ skipped: true }))
      .then(() => {
        router.push("/dashboard");
      })
      .catch(() => {
        toast.error(t("error_generic"));
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleRepoSelect = (repo: RepoItemFields) => {
    const parsed = repoOwnerAndName(repo);

    if (parsed == null) {
      toast.error(t("error_generic"));
      return;
    }

    setIsImporting(true);

    void createRepo
      .mutateAsync({ url: repo.fullName })
      .catch((error) => {
        if (!isAlreadyAdded(error)) {
          throw error;
        }
      })
      .then(() => complete.mutateAsync({ skipped: false }).catch(() => {}))
      .then(() => {
        trackClientEvent("welcome_repo_selected", {
          intent,
          repo_name: parsed.name,
          repo_owner: parsed.owner,
        });

        router.push(intentToAnalyzeHref(intent, parsed.owner, parsed.name));
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("error_generic"));
      })
      .finally(() => {
        setIsImporting(false);
      });
  };

  const actions = {
    back: () => {
      setStep((current) => (current === "repo" ? "github" : "welcome"));
    },
    continueFromGithub: () => {
      setStep(hasGithubInstallation ? "repo" : "github");
    },
    continueFromWelcome: handleWelcomeContinue,
    selectRepo: handleRepoSelect,
    skip: handleSkip,
  };

  return {
    actions,
    state: {
      hasGithubAccount: initialState.hasGithubAccount,
      hasGithubInstallation,
      intent,
      isImporting,
      isSaving,
      name,
      setIntent: handleIntentChange,
      setName,
      step,
    },
  };
}
