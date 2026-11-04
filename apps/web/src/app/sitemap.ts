import type { MetadataRoute } from "next";

import { APP_URL } from "@/shared/config/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";
import { buildDocsCanonical } from "@/shared/lib/docs-metadata";
import { docsSource } from "@/shared/lib/docs-source";
import { PUBLIC_ROUTES } from "@/shared/lib/public-routes";
import { getSitemapUrl } from "@/shared/lib/sitemap.utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const sitemapEntries: MetadataRoute.Sitemap = [];

  PUBLIC_ROUTES.forEach(({ changeFrequency, path, priority }) => {
    const languages: Record<string, string> = {};

    LOCALES.forEach((locale) => {
      languages[locale] = getSitemapUrl(APP_URL, path, locale, DEFAULT_LOCALE);
    });

    languages["x-default"] = getSitemapUrl(APP_URL, path, DEFAULT_LOCALE, DEFAULT_LOCALE);

    LOCALES.forEach((locale) => {
      sitemapEntries.push({
        alternates: {
          languages,
        },
        changeFrequency,
        lastModified: new Date(),
        priority,
        url: getSitemapUrl(APP_URL, path, locale, DEFAULT_LOCALE),
      });
    });
  });

  const docsEntries: MetadataRoute.Sitemap = docsSource.getPages().map((page) => ({
    changeFrequency: "weekly",
    lastModified: new Date(),
    priority: page.url === "/docs" ? 0.9 : 0.7,
    url: buildDocsCanonical(APP_URL, page.url),
  }));

  return [...sitemapEntries, ...docsEntries];
}
