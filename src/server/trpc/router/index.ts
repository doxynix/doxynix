import { createTRPCRouter } from "../trpc";
import { analyticsRouter } from "./analytics.router";
import { apiKeyRouter } from "./apikey.router";
import { healthRouter } from "./health.router";
import { notificationRouter } from "./notifications.router";
import { repoAnalysisRouter } from "./repo-analysis.router";
import { repoDetailsRouter } from "./repo-details.router";
import { repoGithubRouter } from "./repo-github.router";
import { repoRouter } from "./repo.router";
import { userRouter } from "./user.router";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  health: healthRouter,
  notification: notificationRouter,
  repo: repoRouter,
  repoAnalysis: repoAnalysisRouter,
  repoDetails: repoDetailsRouter,
  repoGithub: repoGithubRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
