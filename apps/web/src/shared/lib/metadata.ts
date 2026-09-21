import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export type RepoViewType =
  | "overview"
  | "map"
  | "docs"
  | "code"
  | "pulls"
  | "settings"
  | "analyze"
  | "pull_detail"
  | "owner";

function buildMetadata(title: string, description?: string): Metadata {
  return {
    description,
    openGraph: {
      description,
      siteName: "Doxynix",
      title,
      type: "website",
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      title,
    },
  };
}

export function createMetadata(titleKey: string, descKey?: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("Metadata");
    const title = t(titleKey);
    const description = descKey ? t(descKey) : undefined;
    return buildMetadata(title, description);
  };
}

export function createRepoMetadata(view: RepoViewType = "overview") {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<Record<string, string | undefined>>;
  }): Promise<Metadata> {
    const { name = "", number = "", owner = "" } = await params;
    const t = await getTranslations("Metadata");
    const slug = name ? `${owner}/${name}` : owner;

    const values = { name, number, owner, slug };
    const title = t(`repo_${view}_title`, values);
    const description = t(`repo_${view}_desc`, values);

    return buildMetadata(title, description);
  };
}
