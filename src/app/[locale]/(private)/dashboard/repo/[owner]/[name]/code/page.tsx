import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { ParamTypes } from "@/shared/types/app.types";

import { RepoCodeContainer } from "@/features/repo-code-viewer";

import { api } from "@/server/api/server";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: ParamTypes }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoDocsPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const serverApi = await api();
  const repo = await serverApi.repo.getByName({
    name,
    owner,
  });

  if (repo == null) {
    notFound();
  }

  return <RepoCodeContainer repo={repo} />;
}
