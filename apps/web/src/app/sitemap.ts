import type { MetadataRoute } from "next";

import { APP_URL } from "@/shared/config/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";
import { getSitemapUrl } from "@/shared/lib/sitemap.utils";

type RouteConfig = {
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  path: string;
  priority: number;
};

const PUBLIC_ROUTES: RouteConfig[] = [
  { changeFrequency: "daily", path: "", priority: 1.0 },
  { changeFrequency: "weekly", path: "about", priority: 0.8 },
  { changeFrequency: "weekly", path: "support", priority: 0.8 },
  { changeFrequency: "weekly", path: "high-five", priority: 0.7 },
  { changeFrequency: "monthly", path: "privacy", priority: 0.3 },
  { changeFrequency: "monthly", path: "terms", priority: 0.3 },
];

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

  return sitemapEntries;
}
