import { NextRequest } from "next/server";
import { createOpenApiFetchHandler } from "trpc-to-openapi";

import { isDev } from "@/shared/constants/env";

import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

const handler = (req: NextRequest) => {
  return createOpenApiFetchHandler({
    endpoint: "/api/v1",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError: ({ error }) => {
      if (isDev) {
        console.error("OpenAPI Error:", error);
      }
    },
  });
};

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
