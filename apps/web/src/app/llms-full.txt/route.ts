import { APP_URL } from "@/shared/config/env.client";
import { LLMS_CONTENT_TYPE } from "@/shared/lib/llms";
import { buildLlmsFullTxt } from "@/shared/lib/llms-full";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsFullTxt(APP_URL), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": LLMS_CONTENT_TYPE,
    },
  });
}
