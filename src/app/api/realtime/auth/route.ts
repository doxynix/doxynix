import { NextResponse } from "next/server";

import { REALTIME_CONFIG, type AblyCapability } from "@/shared/constants/realtime";

import { getServerAuthSession } from "@/server/infrastructure/auth";
import { logger } from "@/server/infrastructure/logger";
import { realtimeServer } from "@/server/infrastructure/realtime";

const ONE_HOUR = 3600000;

export async function GET() {
  const session = await getServerAuthSession();
  const userId = session?.user.id;
  const clientId = userId == null ? "anonymous" : String(userId);

  const capability: Record<string, AblyCapability[]> = {
    [REALTIME_CONFIG.channels.news]: ["subscribe"],
  };

  if (userId != null) {
    capability[REALTIME_CONFIG.channels.user(userId)] = ["subscribe", "presence"];
    capability[REALTIME_CONFIG.channels.system] = ["subscribe"];
  }

  try {
    const tokenRequest = await realtimeServer.auth.createTokenRequest({
      capability: JSON.stringify(capability),
      clientId,
      ttl: ONE_HOUR,
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    logger.error({ error, msg: "Realtime auth error" });
    return NextResponse.json({ error: "Error requesting token" }, { status: 500 });
  }
}
