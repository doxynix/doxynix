import { createTRPCRouter } from "../trpc";
import { analyticsRouter } from "./analytics.router";
import { apiKeyRouter } from "./api-key.router";
import { generatedFixRouter } from "./generated-fix.router";
import { githubAppRouter } from "./github-app.router";
import { githubBrowseRouter } from "./github-browse.router";
import { healthRouter } from "./health.router";
import { notificationRouter } from "./notifications.router";
import { prAnalysisRouter } from "./pr-analysis.router";
import { repoAnalysisRouter } from "./repo-analysis.router";
import { repoDetailsRouter } from "./repo-details.router";
import { repoRouter } from "./repo.router";
import { userRouter } from "./user.router";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  generatedFix: generatedFixRouter,
  githubApp: githubAppRouter,
  githubBrowse: githubBrowseRouter,
  health: healthRouter,
  notification: notificationRouter,
  prAnalysis: prAnalysisRouter,
  repo: repoRouter,
  repoAnalysis: repoAnalysisRouter,
  repoDetails: repoDetailsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
