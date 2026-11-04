"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useErrorMessage } from "@/shared/i18n/use-error-message";

export function useMemberActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");
  const errorMessage = useErrorMessage();

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.workspace.members.pathFilter());
    void queryClient.invalidateQueries(trpc.workspace.myWorkspaces.pathFilter());
  };

  const onError = (error: { message: string }) => {
    toast.error(errorMessage(error));
  };

  const add = useMutation(
    trpc.workspace.addMember.mutationOptions({
      onError,
      onSuccess: () => {
        toast.success(t("settings_members_added_toast"));
        invalidate();
      },
    }),
  );

  const remove = useMutation(
    trpc.workspace.removeMember.mutationOptions({
      onError,
      onSuccess: () => {
        toast.success(t("settings_members_removed_toast"));
        invalidate();
      },
    }),
  );

  return { add, remove };
}
