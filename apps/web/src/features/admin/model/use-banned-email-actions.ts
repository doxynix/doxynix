"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useErrorMessage } from "@/shared/i18n/use-error-message";

export function useBannedEmailActions() {
  const trpc = useTRPC();
  const t = useTranslations("AdminBannedEmails");
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const invalidate = () => void queryClient.invalidateQueries(trpc.bannedEmail.list.pathFilter());

  const onError = (error: { message: string }) => toast.error(errorMessage(error));

  const create = useMutation(
    trpc.bannedEmail.create.mutationOptions({
      onError,
      onSuccess: (entry) => {
        invalidate();
        toast.success(t("toast_created", { email: entry.email }));
      },
    }),
  );

  const remove = useMutation(
    trpc.bannedEmail.remove.mutationOptions({
      onError,
      onSuccess: () => {
        invalidate();
        toast.success(t("toast_removed"));
      },
    }),
  );

  return { create, remove };
}

export type BannedEmailActions = ReturnType<typeof useBannedEmailActions>;
