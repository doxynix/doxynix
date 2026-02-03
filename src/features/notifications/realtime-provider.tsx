"use client";

import React, { useEffect, useState } from "react";
import * as Ably from "ably";
import { AblyProvider } from "ably/react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { isProd } from "@/shared/constants/env";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";
import { useNotificationActions } from "@/shared/hooks/use-notification-actions";

type Props = { children: React.ReactNode };

export const RealtimeProvider = ({ children }: Props) => {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { invalidateAll } = useNotificationActions();

  const [client, setClient] = useState<Ably.Realtime | null>(null);

  React.useEffect(() => {
    if (userId === null || userId === undefined) return;

    const realtime = new Ably.Realtime({
      authUrl: "/api/realtime/auth",
      autoConnect: true,
      logLevel: isProd ? 0 : 1,
    });

    if (!isProd) {
      realtime.connection.on((state) => {
        console.log("Realtime connection:", state.current);
      });
    }

    setClient(realtime);

    return () => {
      realtime.close();
      setClient(null);
    };
  }, [userId]);

  useEffect(() => {
    if (!client || userId === null || userId === undefined) return;

    const systemChannel = client.channels.get(REALTIME_CONFIG.channels.system);
    const userChannel = client.channels.get(REALTIME_CONFIG.channels.user(userId));

    const handleSystemMsg = (msg: Ably.InboundMessage) => {
      if (msg.name === REALTIME_CONFIG.events.system.maintenance) {
        toast.warning("Внимание! Технические работы через 5 минут.");
      }
    };

    const handleUserMsg = (msg: Ably.InboundMessage) => {
      if (msg.name === REALTIME_CONFIG.events.user.notification) {
        const data = msg.data as { title: string; body: string };
        toast(data.title, { description: data.body });
        invalidateAll();
      }
    };

    void systemChannel.subscribe(handleSystemMsg);
    void userChannel.subscribe(handleUserMsg);

    return () => {
      void systemChannel.unsubscribe(handleSystemMsg);
      void userChannel.unsubscribe(handleUserMsg);

      // systemChannel.detach();
      // userChannel.detach();
    };
  }, [client, userId, invalidateAll]);

  if (!client) return <>{children}</>;

  return <AblyProvider client={client}>{children}</AblyProvider>;
};
