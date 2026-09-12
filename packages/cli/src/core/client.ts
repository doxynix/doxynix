import type { AppRouter } from "@doxynix/web/trpc";
import pkg from "@pkg";
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
          Accept: "application/json",
          Authorization: token ? `Bearer ${token}` : "",
          "User-Agent": `dxnx/${pkg.version}`,
        };
      },
      transformer: superjson,
      url: `${getApiUrl()}/trpc`,
    }),
  ],
});
