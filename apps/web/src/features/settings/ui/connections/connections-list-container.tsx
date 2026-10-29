"use client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { AuthProvidersList } from "./auth-providers-list";
import { GitHubInstallationsList } from "./github-installations-list";
import { PasskeysList } from "./passkeys-list";
import { TwoFactorCard } from "./two-factor-card";

export function ConnectionsListContainer() {
  const trpc = useTRPC();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const { data: githubData, isLoading: isGithubLoading } = useQuery(
    trpc.githubApp.getMyGithubRepos.queryOptions(),
  );

  const { isFetching, refetch: getUrl } = useQuery(
    trpc.githubApp.getGithubInstallUrl.queryOptions(
      {},
      {
        enabled: false,
      },
    ),
  );

  const handleInstall = async () => {
    const { data } = await getUrl();
    if (data != null) {
      window.location.assign(data);
    }
  };

  const { data, isLoading: isAuthLoading } = useQuery(trpc.user.getLinkedAccounts.queryOptions());

  if (isGithubLoading || isAuthLoading) {
    return (
      <div className="grid gap-10">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-48"]}
            />
            <SkeletonText
              lines={1}
              widths={["w-full"]}
            />
          </div>
          <SkeletonList
            className="flex flex-col gap-3"
            count={3}
            renderItem={() => <Skeleton className="h-[86px] w-full" />}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-56"]}
            />
            <SkeletonText
              lines={1}
              widths={["w-full"]}
            />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-[86px] w-full" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col gap-1.5">
              <SkeletonText
                lines={1}
                size="lg"
                widths={["w-48"]}
              />
              <SkeletonText
                lines={1}
                widths={["w-full"]}
              />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
          <Skeleton className="h-[86px] w-full" />
        </section>
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
