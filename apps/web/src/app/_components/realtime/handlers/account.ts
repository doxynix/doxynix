import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { RealtimeDeps, RealtimeHandlers } from "../deps";

export function accountHandlers({ queryClient, trpc }: RealtimeDeps): RealtimeHandlers {
  return {
    [REALTIME_CONFIG.events.user.apiKeyUpdated]: () => {
      void queryClient.invalidateQueries(trpc.apikey.list.pathFilter());
    },
    [REALTIME_CONFIG.events.user.auditUpdated]: () => {
      void queryClient.invalidateQueries(trpc.audit.getActivityLogs.pathFilter());
    },
    [REALTIME_CONFIG.events.user.sessionUpdated]: () => {
      void queryClient.invalidateQueries(trpc.agent.listSessions.pathFilter());
    },
    [REALTIME_CONFIG.events.user.userUpdated]: () => {
      void queryClient.invalidateQueries(trpc.user.me.pathFilter());
      void queryClient.invalidateQueries(trpc.user.getActiveSessions.pathFilter());
      void queryClient.invalidateQueries(trpc.user.getOnboardingState.pathFilter());
    },
  };
}
