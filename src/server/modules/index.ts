import { createTRPCRouter } from "../core/trpc/init";
import { agentChatRouter } from "./agent/agent.router";
import { analysisRouter } from "./analysis/analysis.router";
import { analyticsRouter } from "./analytics/analytics.router";
import { apiKeyRouter } from "./api-keys/api-key.router";
import { auditRouter } from "./audit-logs/audit.router";
import { notificationRouter } from "./notifications/notifications.router";
import { githubAppRouter } from "./repos/github-app.router";
import { githubBrowseRouter } from "./repos/github-browse.router";
import { repoRouter } from "./repos/repo.router";
import { healthRouter } from "./system/health.router";
import { userRouter } from "./users/user.router";

export const appRouter = createTRPCRouter({
  agent: agentChatRouter,
  analysis: analysisRouter,
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  audit: auditRouter,
  githubApp: githubAppRouter,
  githubBrowse: githubBrowseRouter,
  health: healthRouter,
  notification: notificationRouter,
  repo: repoRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
