import type { NextRequest } from "next/server";
import { createOpenApiFetchHandler } from "trpc-to-openapi";

import { API_PREFIX, IS_DEV } from "@/shared/constants/env.client";

import { createContext } from "@/server/api/context";
import { appRouter } from "@/server/api/routers";

const handler = (req: NextRequest) => {
  return createOpenApiFetchHandler({
    createContext: () => createContext({ req }),
    endpoint: API_PREFIX,
    onError: ({ error }) => {
      if (IS_DEV) {
        console.error("OpenAPI Error:", error);
      }
    },
    req,
    router: appRouter,
  });
};

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
