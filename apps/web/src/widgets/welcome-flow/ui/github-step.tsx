"use client";

import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";

import { GithubConnectCard } from "./github-connect-card";
import { TrustNotes } from "./trust-notes";

type Props = {
  hasGithubAccount: boolean;
  hasGithubInstallation: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function GithubStep({
  hasGithubAccount,
  hasGithubInstallation,
  onBack,
  onContinue,
  onSkip,
}: Readonly<Props>) {
  const t = useTranslations("Welcome");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">{t("github_title")}</h1>
        <p className="text-muted-foreground">{t("github_desc")}</p>
      </div>

      <GithubConnectCard
        hasGithubAccount={hasGithubAccount}
        hasGithubInstallation={hasGithubInstallation}
        onContinue={onContinue}
      />

      <TrustNotes />

      <div className="flex items-center justify-between">
        <AppButton
          onClick={onBack}
          variant="ghost"
        >
          {t("back")}
        </AppButton>
        <AppButton
          onClick={onSkip}
          variant="ghost"
        >
          {t("skip")}
        </AppButton>
      </div>
    </div>
  );
}
