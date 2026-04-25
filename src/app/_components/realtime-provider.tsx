"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Ably from "ably";
import { AblyProvider } from "ably/react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { trpc, type RepoStatus } from "@/shared/api/trpc";
import { IS_PROD } from "@/shared/constants/env.flags";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { useRepoActions } from "@/entities/repo/model/use-repo-actions";

import { useNotificationActions } from "@/features/notifications/model/use-notification-actions";

type Props = { children: ReactNode };

export const RealtimeProvider = ({ children }: Props) => {
  const { data: session } = useSession();
  const userId = session?.user.id;

  const { invalidateAll } = useNotificationActions();
  const { invalidate } = useRepoActions();
  const utils = trpc.useUtils();

  const [client, setClient] = useState<Ably.Realtime | null>(null);

  useEffect(() => {
    if (userId == null) return;

    const realtime = new Ably.Realtime({
      authUrl: "/api/realtime/auth",
      autoConnect: true,
      logLevel: IS_PROD ? 0 : 1,
    });

    if (!IS_PROD) {
      realtime.connection.on((state) => {
        console.log("Realtime connection:", state.current);
      });
    }
    // FIXME: дизейблить пока что потом придумаю чет
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(realtime);

    return () => {
      realtime.close();
      setClient(null);
    };
  }, [userId]);

  useEffect(() => {
    if (!client || userId == null) return;

    const systemChannel = client.channels.get(REALTIME_CONFIG.channels.system);
    const userChannel = client.channels.get(REALTIME_CONFIG.channels.user(userId));

    const handleSystemMsg = (msg: Ably.InboundMessage) => {
      if (msg.name === REALTIME_CONFIG.events.system.maintenance) {
        toast.warning("Внимание! Технические работы через 5 минут.");
      }
    };

    const handleUserMsg = (msg: Ably.InboundMessage) => {
      if (msg.name === REALTIME_CONFIG.events.user.notification) {
        const data = msg.data as { body: string; title: string };
        toast.success(data.title, { description: data.body });
        void invalidateAll();
      }
      if (msg.name === REALTIME_CONFIG.events.user.analysisProgress) {
        const payload = msg.data as {
          analysisId: string;
          message: string;
          progress: number;
          status: RepoStatus;
        };

        utils.analytics.getDashboardStats.setData(undefined, (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            recentActivity: oldData.recentActivity.map((activity) =>
              activity.id === payload.analysisId
                ? { ...activity, progress: payload.progress, status: payload.status }
                : activity
            ),
          };
        });

        if (payload.status === "DONE" || payload.status === "FAILED") {
          invalidate();
        }
      }

      if (msg.name === REALTIME_CONFIG.events.user.fileActionCompleted) {
        const payload = msg.data as {
          fixId?: string;
          path?: string;
          type: "AUDIT" | "DOCUMENTATION" | "FIX_GENERATED";
        };

        if (payload.type === "FIX_GENERATED" && payload.fixId != null) {
          void utils.generatedFix.getById.invalidate({ fixId: payload.fixId });
          toast.success("AI код-фикс готов!");
        } else if (payload.path != null) {
          void utils.repoAnalysis.getFileActionResult.invalidate({ path: payload.path });
          toast.success(
            `ИИ завершил ${payload.type === "AUDIT" ? "аудит" : "документирование"} файла!`
          );
        }
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
  }, [
    client,
    userId,
    invalidateAll,
    invalidate,
    utils.analytics.getDashboardStats,
    utils.repoAnalysis.getFileActionResult,
    utils.generatedFix.getById,
  ]);

  if (!client) return <>{children}</>;

  return <AblyProvider client={client}>{children}</AblyProvider>;
};
