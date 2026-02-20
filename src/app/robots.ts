import type { MetadataRoute } from "next";

import { APP_URL } from "@/shared/constants/env.client";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/*/dashboard/", "/api/"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
