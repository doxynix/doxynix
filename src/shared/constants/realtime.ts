export const REALTIME_CONFIG = {
  channels: {
    news: "public-news",
    system: "system-broadcast",
    user: (userId: number | string) => `user:${userId}`,
  },
  events: {
    system: {
      maintenance: "maintenance",
    },
    user: {
      analysisProgress: "analysis-progress",
      auditUpdated: "audit-updated",
      fileActionCompleted: "fileActionCompleted",
      notification: "notification",
      sessionUpdated: "session-updated",
    },
  },
} as const;

export type AblyCapability = "presence" | "publish" | "subscribe";
