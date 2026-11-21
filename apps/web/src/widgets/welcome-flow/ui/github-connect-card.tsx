"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useGithubInstall } from "../model/use-github-install";
import { useGithubOAuth } from "../model/use-github-oauth";

type Props = {
  hasGithubAccount: boolean;
  hasGithubInstallation: boolean;
  onContinue: () => void;
};

type ConnectCardProps = {
  action: ReactNode;
  description: string;
  icon: ReactNode;
  note?: ReactNode;
  title: string;
  tone?: "default" | "success";
};

function ConnectCard({
  action,
  description,
  icon,
  note,
  title,
  tone = "default",
}: Readonly<ConnectCardProps>) {
  return (
    <Card>
      <div className="flex flex-col gap-4 px-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={
              tone === "success"
                ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success"
                : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-foreground"
            }
          >
            {icon}
          </div>

          <div className="min-w-0">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-muted-foreground text-sm">{description}</p>
            {note}
          </div>
        </div>

        <div className="shrink-0">{action}</div>
      </div>
    </Card>
  );
}

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
      <ConnectCard
        action={
          <AppButton
            className="w-full sm:w-auto"
            onClick={onContinue}
          >
            {t("continue")}
          </AppButton>
        }
        description={t("github_connected_desc")}
        icon={<CheckCircle2 className="size-5" />}
        title={t("github_connected")}
        tone="success"
      />
    );
  }

  if (!hasGithubAccount) {
    return (
      <ConnectCard
        action={
          <LoadingButton
            className="w-full gap-2 sm:w-auto"
            isLoading={oauth.isLoading}
            onClick={oauth.signIn}
          >
            <GitHubIcon className="size-4" /> {t("github_signin")}
          </LoadingButton>
        }
        description={t("github_signin_desc")}
        icon={<GitHubIcon className="size-5" />}
        title={t("github_signin")}
      />
    );
  }

  return (
    <ConnectCard
      action={
        <LoadingButton
          className="w-full gap-2 sm:w-auto"
          isLoading={install.isLoading}
          onClick={install.install}
        >
          <GitHubIcon className="size-4" /> {t("github_install")}
        </LoadingButton>
      }
      description={t("github_install_desc")}
      icon={<GitHubIcon className="size-5" />}
      note={
        <p className="mt-2 flex items-center gap-1.5 text-success text-xs">
          <CheckCircle2 className="size-3.5 shrink-0" /> {t("github_account_connected")}
        </p>
      }
      title={t("github_install")}
    />
  );
}
