import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { RealtimeDeps, RealtimeHandlers } from "../deps";

export function agentHandlers({ queryClient, trpc }: RealtimeDeps): RealtimeHandlers {
  return {
    [REALTIME_CONFIG.events.user.agentSessionUpdated]: () => {
      void queryClient.invalidateQueries(trpc.agent.listSessions.pathFilter());
    },
  };
}
