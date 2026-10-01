import { NextResponse } from "next/server";
import openApiDocument from "@public/openapi.json";

import { withApiHandler } from "@/server/utils/with-api-handler";

async function handler() {
  return NextResponse.json(openApiDocument, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}

// withApiHandler logs failures and returns requestId; IS_PROD keeps the underlying reason off the wire.
export const GET = withApiHandler(handler, { scope: "openapi" });
