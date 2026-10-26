"use client";

import type { OnboardingIntent } from "@doxynix/shared";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { IntentPicker } from "./intent-picker";
import { ProductPreview } from "./preview/product-preview";

type Props = {
  hasGithubInstallation: boolean;
  intent: OnboardingIntent;
  isSubmitting: boolean;
  name: string;
  onContinue: () => void;
  onIntentChange: (intent: OnboardingIntent) => void;
  onNameChange: (name: string) => void;
  onSkip: () => void;
};

export function WelcomeStep({
  hasGithubInstallation,
  intent,
  isSubmitting,
  name,
  onContinue,
  onIntentChange,
  onNameChange,
  onSkip,
}: Readonly<Props>) {
  const t = useTranslations("Welcome");
  const canContinue = name.trim().length > 0 && name.trim().length <= 50;

  return (
    <div className="grid w-full min-w-0 gap-10 min-[900px]:grid-cols-[minmax(0,1fr)_420px] min-[900px]:items-center">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">{t("eyebrow")}</p>
          <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">{t("headline")}</h1>
          <p className="text-muted-foreground">{t("subhead")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-name">{t("name_label")}</Label>
          <Input
            autoComplete="name"
            disabled={isSubmitting}
            id="onboarding-name"
            maxLength={50}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t("name_placeholder")}
            value={name}
          />
        </div>

        <IntentPicker
          disabled={isSubmitting}
          onChange={onIntentChange}
          value={intent}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LoadingButton
              disabled={!canContinue}
              isLoading={isSubmitting}
              onClick={onContinue}
            >
              {hasGithubInstallation ? (
                t("continue")
              ) : (
                <>
                  <GitHubIcon /> {t("continue_github")}
                </>
              )}
            </LoadingButton>
            <AppButton
              disabled={isSubmitting}
              onClick={onSkip}
              variant="ghost"
            >
              {t("skip")}
            </AppButton>
          </div>
        </div>
      </div>

      <ProductPreview intent={intent} />
    </div>
  );
}
