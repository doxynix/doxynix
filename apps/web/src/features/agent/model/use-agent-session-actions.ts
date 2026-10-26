import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";

export function useAgentSessionActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Agent");

  const invalidate = () => void queryClient.invalidateQueries(trpc.agent.listSessions.pathFilter());

  const update = useMutation(
    trpc.agent.updateSession.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success(t("chat_renamed_toast"));
        invalidate();
      },
    }),
  );

  const remove = useMutation(
    trpc.agent.deleteSession.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success(t("chat_deleted_toast"));
        invalidate();
      },
    }),
  );

  return { remove, update };
}
