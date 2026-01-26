import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://doxynix.space";
  const locales = ["en", "ru", "de", "es", "zh-CN", "pt-BR", "fr"];

  const paths = ["", "about", "auth", "privacy", "terms", "support"];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  paths.forEach((path) => {
    locales.forEach((locale) => {
      let url = `${baseUrl}`;

      if (locale === "en") {
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
