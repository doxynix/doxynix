"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { AuthProvidersList } from "./auth-providers-list";
import { GitHubInstallationsList } from "./github-installations-list";
import { PasskeysList } from "./passkeys-list";
import { TwoFactorCard } from "./two-factor-card";

export function ConnectionsListContainer() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const { data: githubData, isLoading: isGithubLoading } =
    trpc.githubApp.getMyGithubRepos.useQuery();

  const { isFetching, refetch: getUrl } = trpc.githubApp.getGithubInstallUrl.useQuery(
    {},
    {
      enabled: false,
    },
  );

  const handleInstall = async () => {
    const { data } = await getUrl();
    if (data != null) {
      window.location.assign(data);
    }
  };

  const { data, isLoading: isAuthLoading } = trpc.user.getLinkedAccounts.useQuery();

  if (isGithubLoading || isAuthLoading) {
    return (
      <div className="grid gap-8">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2>{t("settings_connections_auth_title")}</h2>
          <p className="text-muted-foreground text-sm">{t("settings_connections_auth_desc")}</p>
        </div>
        <div className="flex flex-col gap-3">
          <TwoFactorCard />
          <AuthProvidersList
            accounts={data?.accounts ?? []}
            user={data?.user ?? null}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2>{t("settings_connections_biometric_title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("settings_connections_biometric_desc")}
          </p>
        </div>
        <PasskeysList />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2>{t("settings_connections_github_title")}</h2>
            <p className="text-muted-foreground text-sm">{t("settings_connections_github_desc")}</p>
          </div>
          <LoadingButton
            disabled={isFetching}
            isLoading={isFetching}
            loadingText={tCommon("processing")}
            onClick={() => void handleInstall()}
            variant="outline"
          >
            <Plus /> {tCommon("add_new")}
          </LoadingButton>
        </div>
        <GitHubInstallationsList installations={githubData?.installations ?? []} />
      </section>
    </div>
  );
}
