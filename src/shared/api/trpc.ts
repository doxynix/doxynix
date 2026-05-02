import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/routers";

export const trpc = createTRPCReact<AppRouter>();

export type RouterInput = inferRouterInputs<AppRouter>;

export type RouterOutput = inferRouterOutputs<AppRouter>;
