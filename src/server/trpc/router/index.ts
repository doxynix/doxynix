import { analyticsRouter } from "@/server/trpc/router/analytics";
import { apiKeyRouter } from "@/server/trpc/router/apikey";
import { healthRouter } from "@/server/trpc/router/health";
import { repoRouter } from "@/server/trpc/router/repo";
import { userRouter } from "@/server/trpc/router/user";
import { createTRPCRouter } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  analytics: analyticsRouter,
  repo: repoRouter,
  user: userRouter,
  apikey: apiKeyRouter,
});

export type AppRouter = typeof appRouter;
