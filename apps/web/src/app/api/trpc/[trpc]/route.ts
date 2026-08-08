import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { TRPC_PREFIX } from "@/shared/constants/env.client";
import { IS_DEV } from "@/shared/constants/env.flags";

import { createContext } from "@/server/core/trpc/context";
import { appRouter } from "@/server/modules";
import {
  buildRequestStore,
  requestContext,
  resolveRequestId,
} from "@/server/utils/request-context";

const handler = async (req: NextRequest) => {
  const store = buildRequestStore({
    method: req.method,
    path: TRPC_PREFIX,
    req,
    requestId: resolveRequestId(req),
  });

  return requestContext.run(store, () =>
    fetchRequestHandler({
      createContext: () => createContext({ req }),
      endpoint: TRPC_PREFIX,
      onError: IS_DEV
        ? ({ error, path }) => {
            console.error(`tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
          }
        : undefined,
      req,
      router: appRouter,
    })
  );
};

export { handler as GET, handler as POST };
