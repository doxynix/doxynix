import type { Status } from "@doxynix/shared";
import Ably from "ably";

import { IS_PROD, IS_TEST } from "@/shared/config/env.flags";
import { ABLY_API_KEY } from "@/shared/config/env.server";
import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { appLogger } from "./app-logger";

// Irreducible: `globalThis` has no `ably`; this is the Next.js dev-HMR singleton idiom, so the instance is parked on the global across reloads.
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
  [REALTIME_CONFIG.events.user.agentSessionUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.analysisProgress]: {
    analysisId: string;
    message: string;
    progress?: number;
    status: Status;
  };
  [REALTIME_CONFIG.events.user.analysisUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.apiKeyUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.auditUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.fileActionCompleted]: {
    path: string;
    type: "AUDIT" | "DOCUMENTATION";
  };
  [REALTIME_CONFIG.events.user.notification]: {
    id: string;
    title: string;
  };
  [REALTIME_CONFIG.events.user.notificationUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.userUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.prCommentReceived]: {
    author: string;
    authorAvatarUrl?: null | string;
    commentId: string;
    prNumber: number;
    prTitle: string;
    repoName: string;
    repoOwner: string;
  };
  [REALTIME_CONFIG.events.user.repoUpdated]: Record<string, never>;
  [REALTIME_CONFIG.events.user.sessionUpdated]: {
    sessionId: string;
    title: string;
  };
  [REALTIME_CONFIG.events.user.stagingUpdated]: Record<string, never>;
};

export type SystemEventPayloads = {
  [REALTIME_CONFIG.events.system.maintenance]: {
    message: string;
    startsAt?: string;
  };
};

export type AllEventPayloads = SystemEventPayloads & UserEventPayloads;

export type UserBatchEvent = {
  [K in keyof UserEventPayloads]: { data: UserEventPayloads[K]; name: K };
}[keyof UserEventPayloads];

// Ably's batch endpoint: one `POST /messages` for every event. The `2` is the REST API version
// ably-js documents for `request()`, the same one its own `batchPublish` sends.
async function safeBatchPublish(
  channelName: string,
  events: UserBatchEvent[],
  meta: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await realtimeServer.request(
      "post",
      "/messages",
      2,
      {},
      {
        channels: [channelName],
        messages: events,
      },
    );

    // `request` resolves for error responses too, so only a 2xx means the batch was accepted.
    if (response.success) {
      return true;
    }

    // A partial failure still retries every event: a duplicate beats a dropped completion.
    appLogger.error({
      channel: channelName,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
      msg: "Batch publish rejected by Ably, falling back to sequential publish",
      statusCode: response.statusCode,
      ...meta,
    });
    return false;
  } catch (error) {
    appLogger.error({
      channel: channelName,
      error: error instanceof Error ? error.message : String(error),
      msg: "Failed to batch publish realtime events, falling back to sequential publish",
      ...meta,
    });
    return false;
  }
}

async function safePublish(
  channelName: string,
  event: string,
  data: unknown,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  // Test credentials are placeholders, so the request always 401s after a ~1s round trip.
  if (IS_TEST) {
    return false;
  }

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

  user: (userId: null | string | undefined) => ({
    publish: <K extends keyof UserEventPayloads>(event: K, data: UserEventPayloads[K]) =>
      userId != null
        ? safePublish(REALTIME_CONFIG.channels.user(String(userId)), event, data, {
            userId: String(userId),
          })
        : Promise.resolve(false),
  }),

  userBatch: async (userId: null | string | undefined, events: UserBatchEvent[]) => {
    if (userId == null || events.length === 0 || IS_TEST) {
      return;
    }

    const channelName = REALTIME_CONFIG.channels.user(String(userId));
    const meta = { userId: String(userId) };

    if (await safeBatchPublish(channelName, events, meta)) {
      return;
    }

    for (const { data, name } of events) {
      await safePublish(channelName, name, data, meta);
    }
  },
};
