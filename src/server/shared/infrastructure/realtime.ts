import Ably from "ably";

import { IS_PROD } from "@/shared/constants/env.client";
import { ABLY_API_KEY } from "@/shared/constants/env.server";

const globalForAbly = globalThis as unknown as { ably?: Ably.Rest };

export const realtimeServer =
  globalForAbly.ably ??
  new Ably.Rest({
    key: ABLY_API_KEY,
  });

if (!IS_PROD) globalForAbly.ably = realtimeServer;
