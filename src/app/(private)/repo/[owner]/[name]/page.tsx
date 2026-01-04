import { notFound } from "next/navigation";

import { api } from "@/server/trpc/server";

type Props = {
  params: Promise<{
    owner: string;
    name: string;
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { owner, name } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoOwnerNamePage({ params }: Props) {
  const { owner, name } = await params;

  const repo = await (
    await api()
  ).repo.getByName({
    owner,
    name,
  });

  if (repo === null || repo === undefined) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="flex items-center text-2xl font-bold">
        {repo.owner} / {repo.name}
      </h1>
      <p className="text-muted-foreground">{repo.description}</p>

      <div>
        ID: {repo.id} <br />
        Статус: {repo.status}
      </div>
    </div>
  );
}
