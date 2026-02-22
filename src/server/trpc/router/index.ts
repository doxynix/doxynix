import { analyticsRouter } from "@/server/trpc/router/analytics.router";
import { apiKeyRouter } from "@/server/trpc/router/apikey.router";
import { healthRouter } from "@/server/trpc/router/health.router";
import { notificationRouter } from "@/server/trpc/router/notificatons.router";
import { repoRouter } from "@/server/trpc/router/repo.router";
import { userRouter } from "@/server/trpc/router/user.router";
import { createTRPCRouter } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  health: healthRouter,
  notification: notificationRouter,
  repo: repoRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
