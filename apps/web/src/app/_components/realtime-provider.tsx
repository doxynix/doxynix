"use client";

import { type ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import * as Ably from "ably";
import { AblyProvider, ChannelProvider, useChannel } from "ably/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { IS_PROD } from "@/shared/config/env.flags";
import { REALTIME_CONFIG } from "@/shared/config/realtime";
import { useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";

import { useRepoActions } from "@/entities/repo/model/use-repo-actions";

import { useNotificationActions } from "@/features/notifications/model/use-notification-actions";

import { parseRealtimePayload, RealtimeUserPayloads } from "./realtime-payloads";

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
    // oxlint-disable-next-line react/set-state-in-effect
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
  const router = useRouter();
  const t = useTranslations("Dashboard");

  const { invalidateAll } = useNotificationActions();
  const { invalidate } = useRepoActions();
  const utils = trpc.useUtils();

  useChannel(REALTIME_CONFIG.channels.system, (message: Ably.Message) => {
    if (message.name === REALTIME_CONFIG.events.system.maintenance) {
      toast.warning(t("realtime_maintenance_warning"));
    }
  });

  useChannel(REALTIME_CONFIG.channels.user(userId), (message: Ably.Message) => {
    if (message.name === REALTIME_CONFIG.events.user.notification) {
      const data = parseRealtimePayload(RealtimeUserPayloads.notification, message.data);
      if (data == null) {
        return;
      }
      toast.success(data.title, { description: data.body });
      void invalidateAll();
    }

    if (message.name === REALTIME_CONFIG.events.user.fileActionCompleted) {
      const payload = parseRealtimePayload(RealtimeUserPayloads.fileActionCompleted, message.data);
      if (payload == null) {
        return;
      }

      if (payload.type === "FIX_GENERATED" && payload.fixId != null) {
        void utils.analysis.getById.invalidate({ fixId: payload.fixId });
        toast.success(t("realtime_fix_ready"));
      } else if (payload.path != null) {
        const action = payload.type === "AUDIT" ? "quick-file-audit" : "document-file-preview";
        void utils.analysis.getFileActionResult.invalidate({ action, path: payload.path });
        toast.success(
          payload.type === "AUDIT"
            ? t("realtime_file_audit_done")
            : t("realtime_file_document_done"),
        );
      }
    }

    if (message.name === REALTIME_CONFIG.events.user.prCommentReceived) {
      const payload = parseRealtimePayload(
        RealtimeUserPayloads[REALTIME_CONFIG.events.user.prCommentReceived],
        message.data,
      );
      if (payload == null) {
        return;
      }

      void utils.analysis.getComments.invalidate();

      toast.info(t("realtime_pr_comment_title", { number: payload.prNumber }), {
        action: {
          label: t("view"),
          onClick: () => {
            router.push(
              `/dashboard/repo/${payload.repoOwner}/${payload.repoName}/pull/${payload.prNumber}`,
            );
          },
        },
        description: t("realtime_pr_comment_desc", {
          author: payload.author,
          title: payload.prTitle,
        }),
        icon: (
          <Image
            alt={payload.author}
            className="size-4 rounded-full"
            height={16}
            src={payload.authorAvatarUrl}
            width={16}
          />
        ),
      });
    }

    if (message.name === REALTIME_CONFIG.events.user.analysisProgress) {
      const payload = parseRealtimePayload(
        RealtimeUserPayloads[REALTIME_CONFIG.events.user.analysisProgress],
        message.data,
      );
      if (payload == null) {
        return;
      }

      utils.analytics.getDashboardStats.setData({}, (oldData) => {
        if (oldData == null) {
          return oldData;
        }

        return {
          ...oldData,
          recentActivity: oldData.recentActivity.map((activity) =>
            activity.id === payload.analysisId
              ? { ...activity, progress: payload.progress, status: payload.status }
              : activity,
          ),
        };
      });

      if (payload.status === "DONE" || payload.status === "FAILED") {
        invalidate();

        void utils.analysis.getLatest.invalidate();
        void utils.analysis.getHistory.invalidate();
      }
    }

    if (message.name === REALTIME_CONFIG.events.user.auditUpdated) {
      void utils.audit.getActivityLogs.invalidate();
    }
    if (message.name === REALTIME_CONFIG.events.user.sessionUpdated) {
      void utils.agent.listSessions.invalidate();
    }
  });

  return null;
}
