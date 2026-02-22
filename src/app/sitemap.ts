import type { MetadataRoute } from "next";

import { APP_URL } from "@/shared/constants/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/constants/locales";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "about", "auth", "privacy", "terms", "support"];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  paths.forEach((path) => {
    LOCALES.forEach((locale) => {
      let url = `${APP_URL}`;

      if (locale === DEFAULT_LOCALE) {
        url += path ? `/${path}` : "";
      } else {
        url += `/${locale}${path ? `/${path}` : ""}`;
      }

      sitemapEntries.push({
        changeFrequency: "weekly",
        lastModified: new Date(),
        priority: path === "" ? 1 : 0.8,
        url,
        // NOTE: alternate refs (next-intl это любит, но для простого sitemap можно и так)
      });
    });
  });

  return sitemapEntries;
}
