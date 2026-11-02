import { APP_URL } from "@/shared/config/env.client";
import { buildLlmsTxt, LLMS_CONTENT_TYPE } from "@/shared/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsTxt(APP_URL), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": LLMS_CONTENT_TYPE,
    },
  });
}
