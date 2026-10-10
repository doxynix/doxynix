import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/core/auth";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";

const handlers = toNextJsHandler(auth);

function withContext(handler: (req: Request) => Promise<Response>) {
  return (req: Request) =>
    requestContext.run(buildRequestStore({ method: req.method, path: "/api/auth", req }), () =>
      handler(req),
    );
}

export const GET = withContext(handlers.GET);
export const POST = withContext(handlers.POST);
