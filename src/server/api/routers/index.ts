import { analyticsRouter } from "../../modules/analytics/analytics.router";
import { notificationRouter } from "../../modules/notifications/notifications.router";
import { repoRouter } from "../../modules/repos/repo.router";
import { apiKeyRouter } from "../../modules/users/api-key.router";
import { userRouter } from "../../modules/users/user.router";
import { createTRPCRouter } from "../trpc";
import { auditRouter } from "./audit.router";
import { generatedFixRouter } from "./generated-fix.router";
import { githubAppRouter } from "./github-app.router";
import { githubBrowseRouter } from "./github-browse.router";
import { healthRouter } from "./health.router";
import { prAnalysisRouter } from "./pr-analysis.router";
import { prStagingRouter } from "./pr-staging.router";
import { repoAnalysisRouter } from "./repo-analysis.router";
import { repoDetailsRouter } from "./repo-details.router";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  audit: auditRouter,
  generatedFix: generatedFixRouter,
  githubApp: githubAppRouter,
  githubBrowse: githubBrowseRouter,
  health: healthRouter,
  notification: notificationRouter,
  prAnalysis: prAnalysisRouter,
  prStaging: prStagingRouter,
  repo: repoRouter,
  repoAnalysis: repoAnalysisRouter,
  repoDetails: repoDetailsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
