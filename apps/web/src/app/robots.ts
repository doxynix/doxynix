import type { MetadataRoute } from "next";

import { APP_URL } from "@/shared/constants/env.client";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: "/",
        disallow: [
          "/dashboard/",
          "/*/dashboard/",
          "/api/",
          "/auth",
          "/*/auth",
          "/welcome",
          "/*/welcome",
        ],
        userAgent: "*",
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
