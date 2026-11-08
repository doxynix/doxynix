import Image from "next/image";
import { toast } from "sonner";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { parseRealtimePayload, RealtimeUserPayloads } from "../../realtime-payloads";
import type { RealtimeDeps, RealtimeHandlers } from "../deps";

export function notificationHandlers({
  invalidateAll,
  queryClient,
  router,
  t,
  trpc,
}: RealtimeDeps): RealtimeHandlers {
  return {
    [REALTIME_CONFIG.events.user.notification]: (message) => {
      const data = parseRealtimePayload(RealtimeUserPayloads.notification, message.data);

      if (data == null) {
        return;
      }

      toast.success(data.title, { description: data.body });
      void invalidateAll();
    },
    [REALTIME_CONFIG.events.user.notificationUpdated]: () => {
      void invalidateAll();
    },
    [REALTIME_CONFIG.events.user.prCommentReceived]: (message) => {
      const payload = parseRealtimePayload(
        RealtimeUserPayloads[REALTIME_CONFIG.events.user.prCommentReceived],
        message.data,
      );

      if (payload == null) {
        return;
      }

      void queryClient.invalidateQueries(trpc.analysis.getComments.pathFilter());

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
    },
  };
}
