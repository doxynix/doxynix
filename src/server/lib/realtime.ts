import Ably from "ably";

import { ABLY_API_KEY, isProd } from "@/shared/constants/env";

const globalForAbly = globalThis as unknown as { ably: Ably.Rest };

export const realtimeServer =
  globalForAbly.ably ??
  new Ably.Rest({
    key: ABLY_API_KEY,
  });

if (!isProd) globalForAbly.ably = realtimeServer;
