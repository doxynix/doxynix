import type { RealtimeDeps, RealtimeHandlers } from "./deps";
import { accountHandlers } from "./handlers/account";
import { agentHandlers } from "./handlers/agent";
import { analysisHandlers } from "./handlers/analysis";
import { notificationHandlers } from "./handlers/notifications";
import { repoHandlers } from "./handlers/repos";
import { systemHandlers } from "./handlers/system";

export function buildSystemHandlers(deps: RealtimeDeps): RealtimeHandlers {
  return systemHandlers(deps);
}

export function buildUserHandlers(deps: RealtimeDeps): RealtimeHandlers {
  return {
    ...accountHandlers(deps),
    ...agentHandlers(deps),
    ...analysisHandlers(deps),
    ...notificationHandlers(deps),
    ...repoHandlers(deps),
  };
}
