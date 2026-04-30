"use client";

import { Button } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { ConnectionCard } from "./connection-card";

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
  return (
    <div className="grid gap-3">
      {installations.map((inst) => (
        <ConnectionCard
          key={inst.id}
          action={
            <Button asChild size="sm" variant="outline">
              <ExternalLink href={inst.manageUrl ?? ""}>
                <GitHubIcon /> Configure
              </ExternalLink>
            </Button>
          }
          description="GitHub App Installation"
          icon={<AppAvatar alt={inst.login} src={inst.avatar} />}
          status="Active"
          title={inst.login}
        />
      ))}
    </div>
  );
}
