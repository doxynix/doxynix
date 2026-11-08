"use client";
import { type ReactNode, useEffect, useState } from "react";
import * as Ably from "ably";
import { AblyProvider, ChannelProvider, useChannel } from "ably/react";

import { IS_PROD } from "@/shared/config/env.flags";
import { REALTIME_CONFIG } from "@/shared/config/realtime";
import { authClient } from "@/shared/lib/auth-client";

import { useRealtimeDeps } from "./realtime/deps";
import { buildSystemHandlers, buildUserHandlers } from "./realtime/realtime-handlers";

type Props = { children: ReactNode };

export const RealtimeProvider = ({ children }: Props) => {
  const { data: session } = authClient.useSession();

  return (
    <>
      {children}
      <RealtimeBridge userId={session?.user.id} />
    </>
  );
};

function RealtimeBridge({ userId }: { userId: string | undefined }) {
  const [client, setClient] = useState<Ably.Realtime | null>(null);

  useEffect(() => {
    if (userId == null) {
      return;
    }

    const realtime = new Ably.Realtime({
      authUrl: "/api/realtime/auth",
      autoConnect: true,
      logLevel: IS_PROD ? 0 : 1,
    });

    if (!IS_PROD) {
      realtime.connection.on((state) => {
        console.info("Realtime connection:", state.current);
      });
    }

    // A client cannot exist during SSR, so the bridge needs one extra render to publish it. That
    // renders this component alone; `children` of RealtimeProvider stays at the same index.
    // oxlint-disable-next-line react/set-state-in-effect -- the Ably client exists only in the browser
    setClient(realtime);

    return () => {
      realtime.close();
      setClient(null);
    };
  }, [userId]);

  if (client == null || userId == null) {
    return null;
  }

  return (
    <AblyProvider client={client}>
      <ChannelProvider channelName={REALTIME_CONFIG.channels.system}>
        <ChannelProvider channelName={REALTIME_CONFIG.channels.user(userId)}>
          <RealtimeSubscriptions userId={userId} />
        </ChannelProvider>
      </ChannelProvider>
    </AblyProvider>
  );
}

function RealtimeSubscriptions({ userId }: { userId: string }) {
  const deps = useRealtimeDeps();
  const systemHandlers = buildSystemHandlers(deps);
  const userHandlers = buildUserHandlers(deps);

  useChannel(REALTIME_CONFIG.channels.system, (message: Ably.Message) => {
    if (message.name == null) {
      return;
    }

    systemHandlers[message.name]?.(message);
  });

  useChannel(REALTIME_CONFIG.channels.user(userId), (message: Ably.Message) => {
    if (message.name == null) {
      return;
    }

    userHandlers[message.name]?.(message);
  });

  return null;
}
