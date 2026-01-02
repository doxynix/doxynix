import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "trpc-to-openapi";

import { appRouter } from "@/server/trpc/router";

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

export const GET = () => {
  try {
    const openApiDocument = generateOpenApiDocument(appRouter, {
      title: "Doxynix API",
      description: "Official Doxynix API documentation for developers.",
      version: "1.0.0",
      baseUrl: `${getBaseUrl()}/api/v1`,
      docsUrl: "https://docs.doxynix.space",
      tags: ["repositories", "analytics", "users", "health"],
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: getCookieName(),
          description: "Authorization via session cookie",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description:
            "Используйте API Key, созданный в настройках профиля на https://doxynix.space/settings?tab=api-key",
        },
      },
    });

    return NextResponse.json(openApiDocument);
  } catch (error) {
    console.error("OpenAPI Generation Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate OpenAPI document",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};
