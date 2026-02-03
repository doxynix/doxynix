import { analyticsRouter } from "@/server/trpc/router/analytics.router";
import { apiKeyRouter } from "@/server/trpc/router/apikey.router";
import { healthRouter } from "@/server/trpc/router/health.router";
import { notificationRouter } from "@/server/trpc/router/notificatons.router";
import { repoRouter } from "@/server/trpc/router/repo.router";
import { userRouter } from "@/server/trpc/router/user.router";
import { createTRPCRouter } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  analytics: analyticsRouter,
  repo: repoRouter,
  user: userRouter,
  apikey: apiKeyRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
