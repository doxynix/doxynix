import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/*/dashboard/", "/api/"],
    },
    sitemap: "https://doxynix.space/sitemap.xml",
  };
}
