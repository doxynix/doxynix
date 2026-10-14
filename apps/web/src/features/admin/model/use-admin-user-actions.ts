"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function useAdminUserActions() {
  const t = useTranslations("AdminUsers");
  const utils = trpc.useUtils();

  const invalidate = () => void utils.adminUser.list.invalidate();

  const onError = (error: { message: string }) => toast.error(error.message);

  const revokeSession = trpc.adminUser.revokeSession.useMutation({
    onError,
    onSuccess: () => {
      void utils.adminUser.listSessions.invalidate();
      toast.success(t("toast_session_revoked"));
    },
  });

  const setRole = trpc.adminUser.setRole.useMutation({
    onError,
    onSuccess: ({ user }) => {
      invalidate();
      toast.success(t("toast_role_updated", { name: user.name ?? user.id }));
    },
  });

  const setBanned = trpc.adminUser.setBanned.useMutation({
    onError,
    onSuccess: ({ user }) => {
      invalidate();
      toast.success(user.banned ? t("toast_banned") : t("toast_unbanned"));
    },
  });

  const deleteUser = trpc.adminUser.deleteUser.useMutation({
    onError,
    onSuccess: () => {
      invalidate();
      toast.success(t("toast_deleted"));
    },
  });

  return { deleteUser, revokeSession, setBanned, setRole };
}

export type AdminUserActions = ReturnType<typeof useAdminUserActions>;
