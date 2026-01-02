import type { Metadata } from "next";

type Props = {
  params: Promise<{
    owner: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner } = await params;

  return {
    title: `${owner}`,
    description: `Обзор репозиториев организации ${owner}`,
  };
}

export default async function Owner({ params }: Props) {
  const { owner } = await params;

  return <div>Даров тут конкретные репозитории {owner}</div>;
}
