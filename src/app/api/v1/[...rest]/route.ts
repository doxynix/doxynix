import type { NextRequest } from "next/server";
import { createOpenApiFetchHandler } from "trpc-to-openapi";

import { IS_DEV } from "@/shared/constants/env.client";

import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

const handler = (req: NextRequest) => {
  return createOpenApiFetchHandler({
    endpoint: "/api/v1",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError: ({ error }) => {
      if (IS_DEV) {
        console.error("OpenAPI Error:", error);
      }
    },
  });
};

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
