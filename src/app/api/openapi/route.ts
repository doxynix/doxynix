import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "trpc-to-openapi";

import { API_PREFIX, APP_URL } from "@/shared/constants/env";
import { getCookieName } from "@/shared/lib/utils";

import { appRouter } from "@/server/trpc/router";

export const GET = () => {
  try {
    const openApiDocument = generateOpenApiDocument(appRouter, {
      title: "Doxynix API Documentation",
      description: "Official Doxynix API documentation for developers.",
      version: "1.0.0",
      baseUrl: `${APP_URL}${API_PREFIX}`,
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
          description: `Use the API Key created in your profile settings at ${APP_URL}/settings/api-keys`,
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
