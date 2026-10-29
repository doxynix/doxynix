"use client";

import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { ConnectionCard } from "@/entities/connection/ui/connection-card";

type GitHubInstallation = {
  avatar: null | string;
  id: number;
  login: string;
  manageUrl: null | string;
};

type Props = {
  installations: GitHubInstallation[];
};

export function GitHubInstallationsList({ installations }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  return (
    <div className="grid gap-3">
      {installations.map((inst) => (
        <ConnectionCard
          action={
            <AppButton
              asChild
              size="sm"
              variant="outline"
            >
              <ExternalLink href={inst.manageUrl ?? ""}>
                <GitHubIcon /> {t("settings_connections_github_configure")}
              </ExternalLink>
            </AppButton>
          }
          description={t("settings_connections_github_app_desc")}
          icon={
            <AppAvatar
              alt={inst.login}
              fallbackText={inst.login}
              src={inst.avatar}
            />
          }
          key={inst.id}
          status={tCommon("status_active")}
          title={inst.login}
        />
      ))}
    </div>
  );
}
