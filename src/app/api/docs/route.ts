import { ApiReference } from "@scalar/nextjs-api-reference";

import { API_PREFIX, APP_URL } from "@/shared/constants/env.client";
import { getCookieName } from "@/shared/lib/utils";

export const GET = ApiReference({
  authentication: {
    preferredSecurityScheme: "cookieAuth",
    securitySchemes: {
      bearerAuth: {
        bearerFormat: "JWT",
        description: "Use the API Key created in your profile settings.",
        scheme: "bearer",
        type: "http",
      },
      cookieAuth: {
        in: "cookie",
        name: getCookieName(),
        type: "apiKey",
      },
    },
  },
  baseServerURL: `${APP_URL}${API_PREFIX}`,
  customCss: `
    .scalar-powered-by { display: none !important; }

    a[href*="scalar.com"] { display: none !important; }

    .sidebar-footer a { display: none !important; }

    /* .sidebar-footer { display: none !important; } */
  `,
  darkMode: true,
  defaultOpenAllTags: true,
  documentDownloadType: "both",
  hideDownloadButton: false,
  hideModels: false,

  hideSearch: false,
  layout: "modern",
  metaData: {
    description: "Official Doxynix API documentation",
    title: "Doxynix API Documentation",
  },

  operationsSorter: "method",
  searchHotKey: "k",
  showSidebar: true,
  tagsSorter: "alpha",
  theme: "deepSpace",
  title: "Doxynix API Documentation",

  url: "/api/openapi",
  withDefaultFonts: false,
});
