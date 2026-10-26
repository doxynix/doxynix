"use client";

import { useTranslations } from "next-intl";

import type { RepoItemFields } from "@/shared/api/repo.types";
import { AppButton } from "@/shared/ui/core/button";

import { RepoPicker } from "./repo-picker";

type Props = {
  isImporting: boolean;
  onBack: () => void;
  onSelect: (repo: RepoItemFields) => void;
  onSkip: () => void;
};

export function RepoStep({ isImporting, onBack, onSelect, onSkip }: Readonly<Props>) {
  const t = useTranslations("Welcome");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">{t("repo_title")}</h1>
        <p className="text-muted-foreground">{t("repo_desc")}</p>
      </div>

      <RepoPicker
        disabled={isImporting}
        onSelect={onSelect}
      />

      <div className="flex items-center justify-between">
        <AppButton
          disabled={isImporting}
          onClick={onBack}
          variant="ghost"
        >
          {t("back")}
        </AppButton>
        <AppButton
          disabled={isImporting}
          onClick={onSkip}
          variant="ghost"
        >
          {t("skip")}
        </AppButton>
      </div>
    </div>
  );
}
