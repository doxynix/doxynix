import { ApiReference } from "@scalar/nextjs-api-reference";

const getBaseUrl = () => {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://doxynix.space";
};

const getCookieName = () => {
  if (process.env.NODE_ENV === "production") {
    return "__Secure-next-auth.session-token";
  }
  return "next-auth.session-token";
};

export const GET = ApiReference({
  url: "/api/openapi",

  theme: "deepSpace",
  layout: "modern",
  darkMode: true,
  withDefaultFonts: false,

  baseServerURL: `${getBaseUrl()}/api/v1`,

  showSidebar: true,
  hideSearch: false,
  searchHotKey: "k",

  tagsSorter: "alpha",
  operationsSorter: "method",

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
        description: "Используйте API Key, созданный в настройках профиля",
      },
    },
  },

  hideDownloadButton: false,
  documentDownloadType: "both",
});
