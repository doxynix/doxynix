import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { TRPC_PREFIX } from "@/shared/constants/env.client";
import { IS_DEV } from "@/shared/constants/env.flags";

import { createContext } from "@/server/api/context";
import { appRouter } from "@/server/api/routers";

const handler = (req: NextRequest) =>
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
