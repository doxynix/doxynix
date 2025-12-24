import { createTRPCRouter } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
