import { createTRPCRouter } from "../trpc";
import { analyticsRouter } from "./analytics.router";
import { apiKeyRouter } from "./apikey.router";
import { healthRouter } from "./health.router";
import { notificationRouter } from "./notificatons.router";
import { repoRouter } from "./repo.router";
import { userRouter } from "./user.router";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  health: healthRouter,
  notification: notificationRouter,
  repo: repoRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
