"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";

function errorKey(message: string) {
  switch (message) {
    case "ALREADY_MEMBER": {
      return "settings_members_error_already_member";
    }
    case "BILLING_NOT_READY": {
      return "settings_members_error_billing_not_ready";
    }
    case "LAST_OWNER": {
      return "settings_members_error_last_owner";
    }
    case "LIMIT_EXCEEDED": {
      return "settings_members_error_limit";
    }
    case "Owner rights required": {
      return "settings_members_error_owner_only";
    }
    case "UPGRADE_REQUIRED": {
      return "settings_members_error_upgrade_required";
    }
    case "MEMBER_ADD_FAILED": {
      return "settings_members_error_user_not_found";
    }
    case "RATE_LIMITED": {
      return "settings_members_error_rate_limited";
    }
    default: {
      return "settings_members_error_generic";
    }
  }
}

export function useMemberActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.workspace.members.pathFilter());
    void queryClient.invalidateQueries(trpc.workspace.myWorkspaces.pathFilter());
  };

  const onError = (error: { message: string }) => {
    toast.error(t(errorKey(error.message)));
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

  const upgrade = useMutation(
    trpc.workspace.upgradeToPro.mutationOptions({
      onError,
      onSuccess: () => {
        toast.success(t("settings_members_upgraded_toast"));
        invalidate();
      },
    }),
  );

  return { add, remove, upgrade };
}
