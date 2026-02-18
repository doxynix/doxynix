import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@/server/lib/core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {},
});
