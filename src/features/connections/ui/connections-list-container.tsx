"use client";

import { Plus } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { AuthProvidersList } from "./auth-providers-list";
import { GitHubInstallationsList } from "./github-installations-list";

export function ConnectionsListContainer() {
  const { data: githubData, isLoading: isGithubLoading } =
    trpc.githubApp.getMyGithubRepos.useQuery();

  const { isFetching, refetch: getUrl } = trpc.githubApp.getGithubInstallUrl.useQuery(undefined, {
    enabled: false,
  });

  const handleInstall = async () => {
    const { data } = await getUrl();
    if (data != null) window.location.assign(data);
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
      <section className="space-y-4">
        <div>
          <h2>Authentication</h2>
          <p className="text-muted-foreground text-sm">Manage your social login methods.</p>
        </div>
        <AuthProvidersList accounts={data?.accounts ?? []} user={data?.user ?? null} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2>GitHub Installations</h2>
            <p className="text-muted-foreground text-sm">
              Organizations and accounts where Doxynix is installed.
            </p>
          </div>
          <LoadingButton
            disabled={isFetching}
            isLoading={isFetching}
            loadingText="Processing..."
            variant="outline"
            onClick={() => void handleInstall()}
          >
            <Plus /> Add New
          </LoadingButton>
        </div>
        <GitHubInstallationsList installations={githubData?.installations ?? []} />
      </section>
    </div>
  );
}
