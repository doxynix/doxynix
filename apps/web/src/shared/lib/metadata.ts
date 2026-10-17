import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { APP_URL } from "@/shared/config/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";
import { getSitemapUrl } from "@/shared/lib/sitemap.utils";

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

type PageTarget = { locale: string; path: string };

type PageAlternates = { canonical: string; languages: Record<string, string> };

function buildAlternates({ locale, path }: PageTarget): PageAlternates {
  const languages: Record<string, string> = {};

  for (const loc of LOCALES) {
    languages[loc] = getSitemapUrl(APP_URL, path, loc, DEFAULT_LOCALE);
  }

  languages["x-default"] = getSitemapUrl(APP_URL, path, DEFAULT_LOCALE, DEFAULT_LOCALE);

  return {
    canonical: getSitemapUrl(APP_URL, path, locale, DEFAULT_LOCALE),
    languages,
  };
}

function buildMetadata(
  title: string,
  { description, target }: { description?: string; target?: PageTarget },
): Metadata {
  const alternates = target ? buildAlternates(target) : undefined;

  return {
    ...(alternates && { alternates }),
    description,
    openGraph: {
      description,
      ...(alternates?.canonical && { url: alternates.canonical }),
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

export function createMetadata(titleKey: string, descKey?: string, path?: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("Metadata");
    const title = t(titleKey);
    const description = descKey ? t(descKey) : undefined;

    if (path === undefined) {
      return buildMetadata(title, { description });
    }

    return buildMetadata(title, {
      description,
      target: { locale: await getLocale(), path },
    });
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

    return buildMetadata(title, { description });
  };
}
