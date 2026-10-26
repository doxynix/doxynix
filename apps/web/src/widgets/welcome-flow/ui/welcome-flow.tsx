"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { RouterOutput } from "@/shared/api/trpc";
import type { User } from "@/shared/lib/auth-client";
import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";

import { useWelcomeFlow } from "../model/use-welcome-flow";
import { GithubStep } from "./github-step";
import { RepoStep } from "./repo-step";
import { WelcomeProgress } from "./welcome-progress";
import { WelcomeStep } from "./welcome-step";

type Props = {
  initialState: RouterOutput["user"]["getOnboardingState"];
  user: User;
};

export function WelcomeFlow({ initialState, user }: Readonly<Props>) {
  const { preferences } = useAppearancePreferences();
  const reduceMotion = useReducedMotion() || preferences.reduceMotion;
  const { actions, state } = useWelcomeFlow({ initialState, user });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col justify-center gap-8">
      <WelcomeProgress step={state.step} />

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="flex w-full"
          exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
          initial={reduceMotion ? undefined : { opacity: 0, x: 12 }}
          key={state.step}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {state.step === "welcome" && (
            <WelcomeStep
              hasGithubInstallation={state.hasGithubInstallation}
              intent={state.intent}
              isSubmitting={state.isSaving}
              name={state.name}
              onContinue={actions.continueFromWelcome}
              onIntentChange={state.setIntent}
              onNameChange={state.setName}
              onSkip={actions.skip}
            />
          )}

          {state.step === "github" && (
            <GithubStep
              hasGithubAccount={state.hasGithubAccount}
              hasGithubInstallation={state.hasGithubInstallation}
              onBack={actions.back}
              onContinue={actions.continueFromGithub}
              onSkip={actions.skip}
            />
          )}

          {state.step === "repo" && (
            <RepoStep
              isImporting={state.isImporting}
              onBack={actions.back}
              onSelect={actions.selectRepo}
              onSkip={actions.skip}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
