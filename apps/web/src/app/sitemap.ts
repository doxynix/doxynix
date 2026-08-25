import type { MetadataRoute } from "next";

import { APP_URL } from "@/shared/constants/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/constants/locales";

type RouteConfig = {
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  path: string;
  priority: number;
};

const PUBLIC_ROUTES: RouteConfig[] = [
  {
    changeFrequency: "daily",
    path: "",
    priority: 1.0,
  },
  {
    changeFrequency: "weekly",
    path: "about",
    priority: 0.8,
  },
  {
    changeFrequency: "weekly",
    path: "support",
    priority: 0.8,
  },
  {
    changeFrequency: "weekly",
    path: "thanks",
    priority: 0.7,
  },
  {
    changeFrequency: "monthly",
    path: "privacy",
    priority: 0.3,
  },
  {
    changeFrequency: "monthly",
    path: "terms",
    priority: 0.3,
  },
];

function getUrl(path: string, locale: string): string {
  const baseUrl = APP_URL.replace(/\/$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path.slice(1) : path) : "";

  if (locale === DEFAULT_LOCALE) {
    return cleanPath ? `${baseUrl}/${cleanPath}` : baseUrl;
  }

  return cleanPath ? `${baseUrl}/${locale}/${cleanPath}` : `${baseUrl}/${locale}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const sitemapEntries: MetadataRoute.Sitemap = [];

  PUBLIC_ROUTES.forEach(({ changeFrequency, path, priority }) => {
    const languages: Record<string, string> = {};

    LOCALES.forEach((locale) => {
      languages[locale] = getUrl(path, locale);
    });

    languages["x-default"] = getUrl(path, DEFAULT_LOCALE);

    LOCALES.forEach((locale) => {
      sitemapEntries.push({
        alternates: {
          languages,
        },
        changeFrequency,
        lastModified: new Date(),
        priority,
        url: getUrl(path, locale),
      });
    });
  });

  return sitemapEntries;
}
