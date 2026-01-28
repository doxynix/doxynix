import { ApiReference } from "@scalar/nextjs-api-reference";

import { getCookieName } from "@/shared/lib/utils";

const getBaseUrl = () => {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://doxynix.space";
};

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
  baseServerURL: `${getBaseUrl()}/api/v1`,

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
