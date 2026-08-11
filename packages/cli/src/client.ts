import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "../../web/src/server/modules/index.js"

import { getToken } from "./config.js";

const BASE_URL = process.env.DOXYNIX_API_URL || "http://localhost:3000/api";

export const trpc = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${BASE_URL}/trpc`,
            transformer: superjson,
            headers() {
                const token = getToken();
                return {
                    Authorization: token ? `Bearer ${token}` : "",
                };
            },
        }),
    ],
});

