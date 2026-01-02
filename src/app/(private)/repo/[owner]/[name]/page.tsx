import type { Metadata } from "next";

type Props = {
  params: Promise<{
    owner: string;
    name: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, name } = await params;

  return {
    title: `${owner}/${name}`,
    description: `Анализ и документация для репозитория ${owner}/${name}`,
  };
}

export default async function RepoOwnerName({ params }: Props) {
  const { owner, name } = await params;

  return (
    <div className="space-y-4">
      <h1 className="flex items-center text-2xl font-bold">
        {owner} / {name}
      </h1>
      <div>
        Тут будет контент для репозитория <strong>{name}</strong> от <strong>{owner}</strong>
      </div>
    </div>
  );
}
