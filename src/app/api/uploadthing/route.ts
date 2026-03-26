import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@/server/infrastructure/core";

export const runtime = "nodejs";

export const { GET, POST } = createRouteHandler({
  config: {},
  router: ourFileRouter,
});
