import type { Status } from "@prisma/client";
import Ably from "ably";

import { IS_PROD } from "@/shared/constants/env.flags";
import { ABLY_API_KEY } from "@/shared/constants/env.server";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { appLogger } from "./app-logger";

const globalForAbly = globalThis as unknown as { ably?: Ably.Rest };

export const realtimeServer =
  globalForAbly.ably ??
  new Ably.Rest({
    key: ABLY_API_KEY,
  });

if (!IS_PROD) {
  globalForAbly.ably = realtimeServer;
}

export type UserEventPayloads = {
  [REALTIME_CONFIG.events.user.analysisProgress]: {
    analysisId: string;
    message: string;
    progress?: number;
    status: Status;
  };
  [REALTIME_CONFIG.events.user.auditUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.fileActionCompleted]: {
    path: string;
    type: "AUDIT" | "DOCUMENTATION";
  };
  [REALTIME_CONFIG.events.user.notification]: {
    id: string;
    title: string;
  };
  [REALTIME_CONFIG.events.user.prCommentReceived]: {
    author: string;
    authorAvatarUrl?: null | string;
    commentId: string;
    prNumber: number;
    prTitle: string;
    repoName: string;
    repoOwner: string;
  };
  [REALTIME_CONFIG.events.user.sessionUpdated]: {
    sessionId: string;
    title: string;
  };
};

export type SystemEventPayloads = {
  [REALTIME_CONFIG.events.system.maintenance]: {
    message: string;
    startsAt?: string;
  };
};

export type AllEventPayloads = SystemEventPayloads & UserEventPayloads;

async function safePublish(
  channelName: string,
  event: string,
  data: unknown,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  try {
    await realtimeServer.channels.get(channelName).publish(event, data);
    return true;
  } catch (error) {
    appLogger.error({
      channel: channelName,
      error: error instanceof Error ? error.message : String(error),
      event,
      msg: "Failed to publish realtime event",
      ...meta,
    });
    return false;
  }
}

export const realtimeService = {
  channel: (channelName: string) => ({
    publish: <K extends keyof AllEventPayloads>(event: K, data: AllEventPayloads[K]) =>
      safePublish(channelName, event, data),
  }),

  system: {
    publish: <K extends keyof SystemEventPayloads>(event: K, data: SystemEventPayloads[K]) =>
      safePublish(REALTIME_CONFIG.channels.system, event, data),
  },

  user: (userId: null | number | string | undefined) => ({
    publish: <K extends keyof UserEventPayloads>(event: K, data: UserEventPayloads[K]) =>
      userId != null
        ? safePublish(REALTIME_CONFIG.channels.user(String(userId)), event, data, {
            userId: String(userId),
          })
        : Promise.resolve(false),
  }),
};
