import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useErrorMessage } from "@/shared/i18n/use-error-message";

export function useAgentSessionActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Agent");
  const errorMessage = useErrorMessage();

  const invalidate = () => void queryClient.invalidateQueries(trpc.agent.listSessions.pathFilter());

  const update = useMutation(
    trpc.agent.updateSession.mutationOptions({
      onError: (error) => toast.error(errorMessage(error)),
      onSuccess: () => {
        toast.success(t("chat_renamed_toast"));
        invalidate();
      },
    }),
  );

  const remove = useMutation(
    trpc.agent.deleteSession.mutationOptions({
      onError: (error) => toast.error(errorMessage(error)),
      onSuccess: () => {
        toast.success(t("chat_deleted_toast"));
        invalidate();
      },
    }),
  );

  return { remove, update };
}
