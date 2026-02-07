export const REALTIME_CONFIG = {
  channels: {
    system: "system-broadcast",
    news: "public-news",
    user: (userId: string | number) => `user:${userId}`,
  },
  events: {
    system: {
      maintenance: "maintenance",
    },
    user: {
      notification: "notification",
      analysisProgress: "analysis-progress",
    },
  },
} as const;

export type AblyCapability = "publish" | "subscribe" | "presence";
