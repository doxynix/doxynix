import { toast } from "sonner";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { RealtimeDeps, RealtimeHandlers } from "../deps";

export function systemHandlers({ t }: RealtimeDeps): RealtimeHandlers {
  return {
    [REALTIME_CONFIG.events.system.maintenance]: () => {
      toast.warning(t("realtime_maintenance_warning"));
    },
  };
}
