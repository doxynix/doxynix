import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppSearch } from "@/shared/ui/kit/app-search";

import type { SearchParams } from "@/entities/repo/model/repo-setup.types";

import { CreateRepoButton } from "@/features/repo/ui/create-repo-button";
import { DeleteByOwnerDialog } from "@/features/repo/ui/delete-by-owner-dialog";
import { RepoFilters } from "@/features/repo/ui/repo-filters";
import { RepoListContainer } from "@/features/repo/ui/repo-list-container";

import { api } from "@/server/api/server";

type Props = {
  params: Promise<{ owner: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner } = await params;
  return {
    description: `Repository overview for ${owner}`,
    title: owner,
  };
}

export default async function OwnerPage({ params }: Readonly<Props>) {
  const t = await getTranslations("Dashboard");
  const { owner } = await params;

  const serverApi = await api();
  const data = await serverApi.repo.getByOwner({
    owner,
  });

  if (data == null) {
    notFound();
  }

  const avatarUrl = data.ownerAvatarUrl;

  return (
    <div className="mx-auto flex h-full w-full flex-col">
      <div className="not-xs:justify-center mb-4 flex items-center gap-4">
        <AppAvatar alt={owner} sizeClassName="size-9" src={avatarUrl} />
        <h1 className="text-2xl font-bold">{owner}</h1>
      </div>

      <div className="mb-4 flex w-full flex-wrap items-center justify-center gap-2 xl:justify-between">
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <AppSearch placeholder={t("repo_search_repository")} />
          <RepoFilters />
        </div>
        <CreateRepoButton />
        <DeleteByOwnerDialog owner={owner} />
      </div>

      <RepoListContainer config={{ forcedFilters: { owner } }} />
    </div>
  );
}
