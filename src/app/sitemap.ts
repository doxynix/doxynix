import { MetadataRoute } from "next";

import { APP_URL } from "@/shared/constants/env";
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
        url,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.8,
        // Опционально: alternate refs (next-intl это любит, но для простого sitemap можно и так)
      });
    });
  });

  return sitemapEntries;
}
