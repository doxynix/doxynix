import { createTRPCRouter } from "../core/trpc/init";
import { agentChatRouter } from "./agent/agent.router";
import { adminReviewRouter } from "./analysis/admin-review.router";
import { analysisRouter } from "./analysis/analysis.router";
import { analyticsRouter } from "./analytics/analytics.router";
import { apiKeyRouter } from "./api-keys/api-key.router";
import { adminAuditRouter } from "./audit-logs/admin-audit.router";
import { auditRouter } from "./audit-logs/audit.router";
import { bannedEmailRouter } from "./banned-emails/banned-email.router";
import { notificationRouter } from "./notifications/notifications.router";
import { githubAppRouter } from "./repos/github-app.router";
import { githubBrowseRouter } from "./repos/github-browse.router";
import { repoRouter } from "./repos/repo.router";
import { healthRouter } from "./system/health.router";
import { adminUserRouter } from "./users/admin-user.router";
import { userRouter } from "./users/user.router";
import { workspaceRouter } from "./workspaces/workspace.router";

export const appRouter = createTRPCRouter({
  adminAudit: adminAuditRouter,
  adminReview: adminReviewRouter,
  adminUser: adminUserRouter,
  agent: agentChatRouter,
  analysis: analysisRouter,
  analytics: analyticsRouter,
  apikey: apiKeyRouter,
  audit: auditRouter,
  bannedEmail: bannedEmailRouter,
  githubApp: githubAppRouter,
  githubBrowse: githubBrowseRouter,
  health: healthRouter,
  notification: notificationRouter,
  repo: repoRouter,
  user: userRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
