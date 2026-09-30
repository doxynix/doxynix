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

/**
 * The previous `catch` here had no logging branch at all, so a failure to load
 * or serialize the generated spec answered 500 in silence. The wrapper logs it
 * and puts `requestId` in the body, and `IS_PROD` keeps the underlying reason
 * off the wire.
 */
export const GET = withApiHandler(handler, { scope: "openapi" });
