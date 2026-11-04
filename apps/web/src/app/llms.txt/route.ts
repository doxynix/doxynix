import { docsLlms, LLMS_CONTENT_TYPE } from "@/shared/lib/docs-llms";

export const dynamic = "force-static";

export function GET() {
  return new Response(docsLlms.index(), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": LLMS_CONTENT_TYPE,
    },
  });
}
