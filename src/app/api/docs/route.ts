import { ApiReference } from "@scalar/nextjs-api-reference";

import { API_PREFIX, APP_URL } from "@/shared/constants/env.client";
import { getCookieName } from "@/shared/lib/utils";

export const GET = ApiReference({
  url: "/api/openapi",
  title: "Doxynix API Documentation",
  theme: "deepSpace",
  layout: "modern",
  darkMode: true,
  withDefaultFonts: false,
  metaData: {
    title: "Doxynix API Documentation",
    description: "Official Doxynix API documentation",
  },
  baseServerURL: `${APP_URL}${API_PREFIX}`,

  showSidebar: true,
  hideSearch: false,
  searchHotKey: "k",

  tagsSorter: "alpha",
  operationsSorter: "method",
  customCss: `
    .scalar-powered-by { display: none !important; }

    a[href*="scalar.com"] { display: none !important; }

    .sidebar-footer a { display: none !important; }

    /* .sidebar-footer { display: none !important; } */
  `,
  hideModels: false,
  defaultOpenAllTags: true,
  authentication: {
    preferredSecurityScheme: "cookieAuth",
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: getCookieName(),
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Use the API Key created in your profile settings.",
      },
    },
  },

  hideDownloadButton: false,
  documentDownloadType: "both",
});
