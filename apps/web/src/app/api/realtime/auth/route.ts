import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { type AblyCapability, REALTIME_CONFIG } from "@/shared/config/realtime";

import { auth } from "@/server/core/auth";
import { realtimeServer } from "@/server/core/realtime";
import { withApiHandler } from "@/server/utils/with-api-handler";

const ONE_HOUR = 3_600_000;

async function handler() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user.id;
  const clientId = userId == null ? "anonymous" : String(userId);

  const capability: Record<string, AblyCapability[]> = {
    [REALTIME_CONFIG.channels.news]: ["subscribe"],
  };

  if (userId != null) {
    capability[REALTIME_CONFIG.channels.user(userId)] = ["subscribe", "presence"];
    capability[REALTIME_CONFIG.channels.system] = ["subscribe"];
  }

  const tokenRequest = await realtimeServer.auth.createTokenRequest({
    capability: JSON.stringify(capability),
    clientId,
    ttl: ONE_HOUR,
  });

  return NextResponse.json(tokenRequest);
}

export const GET = withApiHandler(handler, { scope: "realtime/auth" });
