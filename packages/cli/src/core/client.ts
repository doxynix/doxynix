import type { AppRouter } from "@doxynix/web/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

import { getApiUrl, getToken } from "./config";

export type RouterOutput = inferRouterOutputs<AppRouter>;
export type RouterInput = inferRouterInputs<AppRouter>;

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      headers() {
        const token = getToken();
        return {
          Authorization: token ? `Bearer ${token}` : "",
        };
      },
      transformer: superjson,
      url: `${getApiUrl()}/trpc`,
    }),
  ],
});
