import { NextResponse } from "next/server";

import { IS_PROD } from "@/shared/constants/env.flags";

import openApiDocument from "../../../../public/openapi.json";

export const runtime = "edge";

export const GET = async () => {
  try {
    return NextResponse.json(openApiDocument, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        details: IS_PROD ? undefined : error instanceof Error ? error.message : String(error),
        error: "Failed to load generated OpenAPI spec",
      },
      { status: 500 }
    );
  }
};
