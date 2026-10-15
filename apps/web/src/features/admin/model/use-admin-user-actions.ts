"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";

export function useAdminUserActions() {
  const trpc = useTRPC();
  const t = useTranslations("AdminUsers");
  const queryClient = useQueryClient();

  const invalidate = () => void queryClient.invalidateQueries(trpc.adminUser.list.pathFilter());

  const onError = (error: { message: string }) => toast.error(error.message);

  const revokeSession = useMutation(
    trpc.adminUser.revokeSession.mutationOptions({
      onError,
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.adminUser.listSessions.pathFilter());
        toast.success(t("toast_session_revoked"));
      },
    }),
  );

  const setRole = useMutation(
    trpc.adminUser.setRole.mutationOptions({
      onError,
      onSuccess: ({ user }) => {
        invalidate();
        toast.success(t("toast_role_updated", { name: user.name ?? user.id }));
      },
    }),
  );

  const setBanned = useMutation(
    trpc.adminUser.setBanned.mutationOptions({
      onError,
      onSuccess: ({ user }) => {
        invalidate();
        toast.success(user.banned ? t("toast_banned") : t("toast_unbanned"));
      },
    }),
  );

  const deleteUser = useMutation(
    trpc.adminUser.deleteUser.mutationOptions({
      onError,
      onSuccess: () => {
        invalidate();
        toast.success(t("toast_deleted"));
      },
    }),
  );

  return { deleteUser, revokeSession, setBanned, setRole };
}

export type AdminUserActions = ReturnType<typeof useAdminUserActions>;
