import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { isDev } from "@/shared/constants/env";

import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError: isDev
      ? ({ path, error }) => {
          console.error(`tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
        }
      : undefined,
  });

export { handler as GET, handler as POST };
