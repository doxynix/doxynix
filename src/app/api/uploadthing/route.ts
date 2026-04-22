import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@/server/shared/infrastructure/uploadthing";

export const runtime = "nodejs";

export const { GET, POST } = createRouteHandler({
  config: {},
  router: ourFileRouter,
});
