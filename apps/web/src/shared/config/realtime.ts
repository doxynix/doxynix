export const REALTIME_CONFIG = {
  channels: {
    news: "public-news",
    system: "system-broadcast",
    user: (userId: string) => `user:${userId}`,
  },
  events: {
    system: {
      maintenance: "maintenance",
    },
    user: {
      agentSessionUpdated: "agent-session-updated",
      analysisProgress: "analysis-progress",
      analysisUpdated: "analysis-updated",
      apiKeyUpdated: "api-key-updated",
      auditUpdated: "audit-updated",
      fileActionCompleted: "fileActionCompleted",
      notification: "notification",
      notificationUpdated: "notification-updated",
      prCommentReceived: "pr-comment-received",
      repoUpdated: "repo-updated",
      sessionUpdated: "session-updated",
      userUpdated: "user-updated",
    },
  },
} as const;

export type AblyCapability = "presence" | "publish" | "subscribe";
