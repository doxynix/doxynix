"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useGithubInstall } from "../model/use-github-install";
import { useGithubOAuth } from "../model/use-github-oauth";

type Props = {
  hasGithubAccount: boolean;
  hasGithubInstallation: boolean;
  onContinue: () => void;
};

export function GithubConnectCard({
  hasGithubAccount,
  hasGithubInstallation,
  onContinue,
}: Readonly<Props>) {
  const t = useTranslations("Welcome");
  const oauth = useGithubOAuth();
  const install = useGithubInstall();

  if (hasGithubInstallation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <div>
            <p className="font-semibold">{t("github_connected")}</p>
            <p className="text-muted-foreground text-sm">{t("github_connected_desc")}</p>
          </div>
          <AppButton onClick={onContinue}>{t("continue")}</AppButton>
        </CardContent>
      </Card>
    );
  }

  if (!hasGithubAccount) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div>
            <p className="font-semibold">{t("github_signin")}</p>
            <p className="text-muted-foreground text-sm">{t("github_signin_desc")}</p>
          </div>
          <LoadingButton
            className="w-fit"
            isLoading={oauth.isLoading}
            onClick={oauth.signIn}
          >
            <GitHubIcon /> {t("github_signin")}
          </LoadingButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5 text-success" />
          {t("github_account_connected")}
        </div>
        <div>
          <p className="font-semibold">{t("github_install")}</p>
          <p className="text-muted-foreground text-sm">{t("github_install_desc")}</p>
        </div>
        <LoadingButton
          className="w-fit"
          isLoading={install.isLoading}
          onClick={install.install}
        >
          <GitHubIcon /> {t("github_install")}
        </LoadingButton>
      </CardContent>
    </Card>
  );
}
