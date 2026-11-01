"use client";

import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RepoItemFields } from "@/shared/api/repo.types";
import { useTRPC } from "@/shared/api/trpc";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { Input } from "@/shared/ui/core/input";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { RepoItem } from "@/entities/repo/ui/repo-item";

import { useGithubOAuth } from "../model/use-github-oauth";

const STALE_TIME = 1000 * 60 * 5;

type Props = {
  disabled?: boolean;
  onSelect: (repo: RepoItemFields) => void;
};

export function RepoPicker({ disabled = false, onSelect }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Welcome");
  const oauth = useGithubOAuth();
  const [search, setSearch] = useState("");
  const [selectedFullName, setSelectedFullName] = useState<null | string>(null);
  const deferredSearch = useDeferredValue(search);

  const { data, isError, isFetching, isLoading, refetch } = useQuery(
    trpc.githubApp.getMyGithubRepos.queryOptions({}, { staleTime: STALE_TIME }),
  );

  const query = deferredSearch.trim().toLowerCase();
  const repos = [...(data?.items ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const items =
    query.length === 0
      ? repos
      : repos.filter((repo) => {
          return (
            repo.fullName.toLowerCase().includes(query) ||
            (repo.description ?? "").toLowerCase().includes(query) ||
            (repo.language ?? "").toLowerCase().includes(query)
          );
        });

  const selectedRepo = items.find((repo) => repo.fullName === selectedFullName) ?? null;
  const manageUrl =
    data?.installations?.[0]?.manageUrl ?? "https://github.com/settings/installations";

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <SkeletonList
            className="flex flex-col gap-2"
            count={5}
            renderItem={() => (
              <div className="flex flex-col gap-2 rounded-xl p-3">
                <SkeletonText
                  lines={1}
                  widths={["w-48"]}
                />
                <SkeletonText
                  lines={1}
                  widths={["w-72"]}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>
    );
  }

  if (isError || data == null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-muted-foreground text-sm">{t("error_generic")}</p>
          <AppButton
            onClick={() => void refetch()}
            variant="outline"
          >
            <RefreshCcw /> {t("retry")}
          </AppButton>
        </CardContent>
      </Card>
    );
  }

  if (data.oauthStatus === "invalid") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-semibold">{t("repo_reconnect")}</p>
          <p className="text-muted-foreground text-sm">{t("repo_reconnect_desc")}</p>
          <LoadingButton
            isLoading={oauth.isLoading}
            onClick={oauth.signIn}
            variant="outline"
          >
            <GitHubIcon /> {t("repo_reconnect")}
          </LoadingButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 text-muted-foreground" />
          <Input
            aria-label={t("repo_search")}
            className="pl-8"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("repo_search")}
            type="search"
            value={search}
          />
        </div>
        <AppButton
          aria-label={t("repo_refresh")}
          disabled={isFetching}
          onClick={() => void refetch()}
          size="icon"
          variant="outline"
        >
          <RefreshCcw className={isFetching ? "animate-spin" : undefined} />
        </AppButton>
      </div>

      <Card>
        <CardContent className="p-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="font-semibold">{t("repo_empty_title")}</p>
              <p className="text-muted-foreground text-sm">{t("repo_empty_desc")}</p>
              <AppButton
                asChild
                variant="outline"
              >
                <a
                  href={manageUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("repo_manage")}
                </a>
              </AppButton>
            </div>
          ) : (
            <div className="flex max-h-[22rem] flex-col gap-0.5 overflow-y-auto p-1">
              {items.map((repo) => (
                <RepoItem
                  className="max-w-none"
                  disabled={disabled}
                  key={repo.fullName}
                  onClick={() => setSelectedFullName(repo.fullName)}
                  repo={repo}
                  selected={repo.fullName === selectedFullName}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">{t("repo_cta_hint")}</p>
        <LoadingButton
          disabled={selectedRepo == null || disabled}
          isLoading={disabled}
          onClick={() => {
            if (selectedRepo != null) {
              onSelect(selectedRepo);
            }
          }}
        >
          {selectedRepo == null ? t("repo_cta") : `${t("repo_cta")} — ${selectedRepo.fullName}`}
        </LoadingButton>
      </div>
    </div>
  );
}
