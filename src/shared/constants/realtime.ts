export const REALTIME_CONFIG = {
  channels: {
    news: "public-news",
    system: "system-broadcast",
    user: (userId: string | number) => `user:${userId}`,
  },
  events: {
    system: {
      maintenance: "maintenance",
    },
    user: {
      analysisProgress: "analysis-progress",
      notification: "notification",
    },
  },
} as const;

export type AblyCapability = "publish" | "subscribe" | "presence";
