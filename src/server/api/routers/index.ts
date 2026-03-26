import { createTRPCRouter } from "../trpc";
import { analyticsRouter } from "./analytics.router";
import { apiKeyRouter } from "./api-key.router";
import { githubAppRouter } from "./github-app.router";
import { githubBrowseRouter } from "./github-browse.router";
import { healthRouter } from "./health.router";
import { notificationRouter } from "./notifications.router";
import { repoAnalysisRouter } from "./repo-analysis.router";
import { repoDetailsRouter } from "./repo-details.router";
import { repoRouter } from "./repo.router";
import { userRouter } from "./user.router";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  githubApp: githubAppRouter,
  githubBrowse: githubBrowseRouter,
  health: healthRouter,
  notification: notificationRouter,
  repo: repoRouter,
  repoAnalysis: repoAnalysisRouter,
  repoDetails: repoDetailsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
