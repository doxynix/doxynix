import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { IS_DEV, TRPC_PREFIX } from "@/shared/constants/env.client";

import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

const handler = (req: Request) =>
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
  });

export { handler as GET, handler as POST };
