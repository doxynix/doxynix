import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "trpc-to-openapi";

import { API_PREFIX, APP_URL } from "@/shared/constants/env.client";
import { logger } from "@/shared/lib/logger";
import { getCookieName } from "@/shared/lib/utils";

import { appRouter } from "@/server/trpc/router";

export const GET = () => {
  try {
    const openApiDocument = generateOpenApiDocument(appRouter, {
      baseUrl: `${APP_URL}${API_PREFIX}`,
      description: "Official Doxynix API documentation for developers.",
      docsUrl: "https://docs.doxynix.space",
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "API Key",
          description: `Use the API Key created in your profile settings at ${APP_URL}/settings/api-keys`,
          scheme: "bearer",
          type: "http",
        },
        cookieAuth: {
          description: "Authorization via session cookie",
          in: "cookie",
          name: getCookieName(),
          type: "apiKey",
        },
      },
      tags: ["repositories", "analytics", "users", "health"],
      title: "Doxynix API Documentation",
      version: "1.0.0",
    });

    return NextResponse.json(openApiDocument);
  } catch (error) {
    logger.error({ error, msg: "OpenAPI Generation Error:" });
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Failed to generate OpenAPI document",
      },
      { status: 500 }
    );
  }
};
