import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { RealtimeDeps, RealtimeHandlers } from "../deps";

export function repoHandlers({ invalidate, queryClient, trpc }: RealtimeDeps): RealtimeHandlers {
  return {
    [REALTIME_CONFIG.events.user.repoUpdated]: () => {
      invalidate();
      void queryClient.invalidateQueries(trpc.repo.getByOwner.pathFilter());
      void queryClient.invalidateQueries(trpc.user.getOnboardingState.pathFilter());
    },
  };
}
