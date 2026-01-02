import { createTRPCReact } from "@trpc/react-query";

import { AppRouter } from "@/server/trpc/router";

export const trpc = createTRPCReact<AppRouter>();
